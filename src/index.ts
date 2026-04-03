import { z } from 'zod';

export type AnyZod = z.ZodTypeAny;
export type Simplify<T> = { [K in keyof T]: T[K] } & {};

export type NodeKind = 'scalar' | 'object' | 'array' | 'optional' | 'nullable' | 'union';

export abstract class ExpeditionNode<
  Output,
  Modes extends string,
  Optional extends boolean,
  Kind extends NodeKind,
> {
  declare readonly _output: Output;
  declare readonly _modes: Modes;
  declare readonly _optional: Optional;
  abstract readonly kind: Kind;

  protected constructor(protected readonly allowedModes: readonly string[]) {}

  public getAllowedModes(): readonly string[] {
    return this.allowedModes;
  }

  public includesMode(mode: string): boolean {
    return this.allowedModes.includes(mode);
  }

  public modes<const TNewModes extends readonly string[]>(modes: TNewModes): any {
    return this.cloneWithModes([...modes]);
  }

  public optional(): OptionalNode<this, Modes, true> {
    return new OptionalNode<this, Modes, true>(this, this.allowedModes);
  }

  public nullable(): NullableNode<this, Modes, false> {
    return new NullableNode<this, Modes, false>(this, this.allowedModes);
  }

  public array(): ArrayNode<this, Modes, false> {
    return new ArrayNode<this, Modes, false>(this, this.allowedModes);
  }

  public parse<TMode extends Modes>(input: unknown, mode: TMode, options: ProjectionOptions = {}): any {
    return this.project(mode, options).parse(input) as any;
  }

  public safeParse<TMode extends Modes>(input: unknown, mode: TMode, options: ProjectionOptions = {}): any {
    return this.project(mode, options).safeParse(input);
  }

  public dump<TMode extends Modes>(input: unknown, mode: TMode, options: ProjectionOptions = {}): any {
    const parsed = this.parse(input, mode, options);
    return this.serializeForMode(parsed, mode) as any;
  }

  public project<TMode extends Modes>(mode: TMode, options: ProjectionOptions = {}): AnyZod {
    return this.toZod(mode, options);
  }

  protected abstract cloneWithModes(modes: readonly string[]): ExpeditionNode<any, any, any, any>;
  public abstract toZod(mode: string, options: ProjectionOptions): AnyZod;
  public abstract serializeForMode(value: unknown, mode: string): unknown;
}

export type AnyNode = ExpeditionNode<any, any, any, any>;
export type NodeOutput<TNode extends AnyNode> = TNode['_output'];
export type NodeModes<TNode extends AnyNode> = TNode['_modes'];

export type Shape = Record<string, AnyNode>;

export type OptionalKeysForMode<
  TShape extends Shape,
  Mode extends string,
> = {
  [K in keyof TShape]-?: [InferMode<TShape[K], Mode>] extends [never]
    ? never
    : TShape[K]['_optional'] extends true
      ? K
      : never;
}[keyof TShape];

export type RequiredKeysForMode<
  TShape extends Shape,
  Mode extends string,
> = Exclude<{
  [K in keyof TShape]-?: [InferMode<TShape[K], Mode>] extends [never]
    ? never
    : TShape[K]['_optional'] extends true
      ? never
      : K;
}[keyof TShape], undefined>;

export type BuildModeObject<
  TShape extends Shape,
  Mode extends string,
> = Simplify<
  {
    [K in RequiredKeysForMode<TShape, Mode>]: InferMode<TShape[K], Mode>;
  } & {
    [K in OptionalKeysForMode<TShape, Mode>]?: InferMode<TShape[K], Mode>;
  }
>;

export class ScalarNode<
  TSchema extends AnyZod,
  Modes extends string = never,
  Optional extends boolean = false,
> extends ExpeditionNode<z.infer<TSchema>, Modes, Optional, 'scalar'> {
  public readonly kind = 'scalar' as const;

  public constructor(private readonly schema: TSchema, modes: readonly string[] = []) {
    super(modes);
  }

  protected cloneWithModes(modes: readonly string[]): ScalarNode<TSchema, any, Optional> {
    return new ScalarNode(this.schema, modes);
  }

  public toZod(mode: string): AnyZod {
    return this.includesMode(mode) ? this.schema : z.never();
  }

  public serializeForMode(value: unknown): unknown {
    return value;
  }
}

export class ObjectNode<
  TShape extends Shape,
  Modes extends string = never,
  Optional extends boolean = false,
> extends ExpeditionNode<BuildModeObject<TShape, Modes>, Modes, Optional, 'object'> {
  public readonly kind = 'object' as const;

  public constructor(private readonly shape: TShape, modes?: readonly string[]) {
    super(modes ?? uniqueModesFromShape(shape));
  }

  public getShape(): TShape {
    return this.shape;
  }

  protected cloneWithModes(modes: readonly string[]): ObjectNode<TShape, any, Optional> {
    return new ObjectNode(this.shape, modes);
  }

  public toZod(mode: string, options: ProjectionOptions): AnyZod {
    if (!this.includesMode(mode)) {
      return z.never();
    }

    const filteredShape: Record<string, AnyZod> = {};
    for (const [key, node] of Object.entries(this.shape)) {
      if (node.includesMode(mode)) {
        filteredShape[key] = node.toZod(mode, options);
      }
    }

    let schema = z.object(filteredShape);
    schema = options.stripUnknown === false ? schema.passthrough() : schema.strip();
    return schema;
  }

  public serializeForMode(value: unknown, mode: string): unknown {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }

    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, node] of Object.entries(this.shape)) {
      if (!node.includesMode(mode) || !(key in input)) {
        continue;
      }
      const serialized = node.serializeForMode(input[key], mode);
      if (serialized !== undefined) {
        output[key] = serialized;
      }
    }
    return output;
  }
}

export class ArrayNode<
  TItem extends AnyNode,
  Modes extends string = never,
  Optional extends boolean = false,
> extends ExpeditionNode<NodeOutput<TItem>[], Modes, Optional, 'array'> {
  public readonly kind = 'array' as const;

  public constructor(private readonly item: TItem, modes: readonly string[] = item.getAllowedModes()) {
    super(modes);
  }

  protected cloneWithModes(modes: readonly string[]): ArrayNode<TItem, any, Optional> {
    return new ArrayNode(this.item, modes);
  }

  public toZod(mode: string, options: ProjectionOptions): AnyZod {
    return this.includesMode(mode) ? z.array(this.item.toZod(mode, options)) : z.never();
  }

  public serializeForMode(value: unknown, mode: string): unknown {
    return Array.isArray(value) ? value.map((entry) => this.item.serializeForMode(entry, mode)) : value;
  }
}

export class OptionalNode<
  TInner extends AnyNode,
  Modes extends string = never,
  Optional extends boolean = true,
> extends ExpeditionNode<NodeOutput<TInner> | undefined, Modes, Optional, 'optional'> {
  public readonly kind = 'optional' as const;

  public constructor(private readonly inner: TInner, modes: readonly string[] = inner.getAllowedModes()) {
    super(modes);
  }

  protected cloneWithModes(modes: readonly string[]): OptionalNode<TInner, any, Optional> {
    return new OptionalNode(this.inner, modes);
  }

  public toZod(mode: string, options: ProjectionOptions): AnyZod {
    return this.includesMode(mode) ? this.inner.toZod(mode, options).optional() : z.never();
  }

  public serializeForMode(value: unknown, mode: string): unknown {
    return value === undefined ? undefined : this.inner.serializeForMode(value, mode);
  }
}

export class NullableNode<
  TInner extends AnyNode,
  Modes extends string = never,
  Optional extends boolean = false,
> extends ExpeditionNode<NodeOutput<TInner> | null, Modes, Optional, 'nullable'> {
  public readonly kind = 'nullable' as const;

  public constructor(private readonly inner: TInner, modes: readonly string[] = inner.getAllowedModes()) {
    super(modes);
  }

  protected cloneWithModes(modes: readonly string[]): NullableNode<TInner, any, Optional> {
    return new NullableNode(this.inner, modes);
  }

  public toZod(mode: string, options: ProjectionOptions): AnyZod {
    return this.includesMode(mode) ? this.inner.toZod(mode, options).nullable() : z.never();
  }

  public serializeForMode(value: unknown, mode: string): unknown {
    return value === null ? null : this.inner.serializeForMode(value, mode);
  }
}

export class UnionNode<
  TMembers extends readonly [AnyNode, ...AnyNode[]],
  Modes extends string = never,
  Optional extends boolean = false,
> extends ExpeditionNode<NodeOutput<TMembers[number]>, Modes, Optional, 'union'> {
  public readonly kind = 'union' as const;

  public constructor(private readonly members: TMembers, modes?: readonly string[]) {
    super(modes ?? uniqueModesFromMembers(members));
  }

  protected cloneWithModes(modes: readonly string[]): UnionNode<TMembers, any, Optional> {
    return new UnionNode(this.members, modes);
  }

  public toZod(mode: string, options: ProjectionOptions): AnyZod {
    if (!this.includesMode(mode)) {
      return z.never();
    }
    const active = this.members.filter((member) => member.includesMode(mode)).map((member) => member.toZod(mode, options));
    if (active.length === 0) {
      return z.never();
    }
    if (active.length === 1) {
      return active[0]!;
    }
    return z.union(active as [AnyZod, AnyZod, ...AnyZod[]]);
  }

  public serializeForMode(value: unknown, mode: string): unknown {
    const activeMembers = this.members.filter((member) => member.includesMode(mode));
    for (const member of activeMembers) {
      const parsed = member.safeParse(value, mode as never);
      if (parsed.success) {
        return member.serializeForMode(parsed.data, mode);
      }
    }
    return value;
  }
}

export type InferMode<TNode extends AnyNode, Mode extends string> =
  TNode extends ScalarNode<infer TSchema, infer TModes, any>
    ? Mode extends TModes
      ? z.infer<TSchema>
      : never
    : TNode extends ObjectNode<infer TShape, infer TModes, any>
      ? Mode extends TModes
        ? BuildModeObject<TShape, Mode>
        : never
      : TNode extends ArrayNode<infer TItem, infer TModes, any>
        ? Mode extends TModes
          ? InferMode<TItem, Mode>[]
          : never
        : TNode extends OptionalNode<infer TInner, infer TModes, any>
          ? Mode extends TModes
            ? InferMode<TInner, Mode>
            : never
          : TNode extends NullableNode<infer TInner, infer TModes, any>
            ? Mode extends TModes
              ? InferMode<TInner, Mode> | null
              : never
            : TNode extends UnionNode<infer TMembers, infer TModes, any>
              ? Mode extends TModes
                ? InferMode<TMembers[number], Mode>
                : never
              : never;

export type InferNode<TNode extends AnyNode> = NodeOutput<TNode>;

export interface ProjectionOptions {
  stripUnknown?: boolean;
}

function uniqueModesFromShape(shape: Shape): readonly string[] {
  const modes = new Set<string>();
  for (const node of Object.values(shape)) {
    for (const mode of node.getAllowedModes()) {
      modes.add(mode);
    }
  }
  return [...modes];
}

function uniqueModesFromMembers(members: readonly AnyNode[]): readonly string[] {
  const modes = new Set<string>();
  for (const member of members) {
    for (const mode of member.getAllowedModes()) {
      modes.add(mode);
    }
  }
  return [...modes];
}

export const expedition = {
  string: () => new ScalarNode(z.string()),
  number: () => new ScalarNode(z.number()),
  boolean: () => new ScalarNode(z.boolean()),
  bigint: () => new ScalarNode(z.bigint()),
  date: () => new ScalarNode(z.date()),
  unknown: () => new ScalarNode(z.unknown()),
  literal: <const TValue extends string | number | boolean | null>(value: TValue) => new ScalarNode(z.literal(value)),
  enum: <const TValues extends readonly [string, ...string[]]>(values: TValues) => new ScalarNode(z.enum(values)),
  array: <TItem extends AnyNode>(item: TItem) => new ArrayNode(item),
  object: <const TShape extends Shape>(shape: TShape) => new ObjectNode<TShape, NodeModes<TShape[keyof TShape]>>(shape),
  union: <const TMembers extends readonly [AnyNode, ...AnyNode[]]>(members: TMembers) => new UnionNode<TMembers, NodeModes<TMembers[number]>>(members),
  fromZod: <TSchema extends AnyZod>(schema: TSchema) => new ScalarNode(schema)
};
