# titanic-expedition

`titanic-expedition` is a TypeScript library for **mode-aware schema projection**.

It is inspired by the core idea behind `pydantic-extension`:

> one domain model, many policy-aware projections.

Instead of duplicating `UserPublic`, `UserInternal`, and `UserLLM`, you define one schema and project it into safe modes.

## Why this exists

Most stacks handle exposure late:

- database stores everything
- backend models know everything
- API DTOs filter later
- prompt builders filter ad hoc

That is how leaks happen.

This library moves projection closer to the schema definition itself.

## Features

- one schema, many modes
- runtime validation via Zod
- mode-specific parsing and dumping
- nested object and array projection
- optional and nullable fields
- union support
- generated TypeScript inference through `InferMode`

## Install

```bash
npm install zod
npm install -D typescript vitest
```

If you want to use this package itself once published:

```bash
npm install titanic-expedition zod
```

## Quick start

```ts
import { expedition, type InferMode } from 'titanic-expedition';

const Alien = expedition.object({
  species: expedition.string().modes(['public', 'llm', 'internal']),
  planet: expedition.string().modes(['public', 'llm', 'internal']),
  invasionPlan: expedition.string().modes(['internal']),
  diplomaticSummary: expedition.string().modes(['llm', 'internal']).optional()
}).modes(['public', 'llm', 'internal']);

type PublicAlien = InferMode<typeof Alien, 'public'>;
type LLMAlien = InferMode<typeof Alien, 'llm'>;
type InternalAlien = InferMode<typeof Alien, 'internal'>;

const raw = {
  species: 'Xylar',
  planet: 'Zebulon',
  invasionPlan: 'Take over Earth',
  diplomaticSummary: 'Harmless envoy cover story'
};

const publicAlien = Alien.dump(raw, 'public');
const llmAlien = Alien.dump(raw, 'llm');
const internalAlien = Alien.dump(raw, 'internal');
```

### Result

```ts
publicAlien
// { species: 'Xylar', planet: 'Zebulon' }

llmAlien
// {
//   species: 'Xylar',
//   planet: 'Zebulon',
//   diplomaticSummary: 'Harmless envoy cover story'
// }

internalAlien
// {
//   species: 'Xylar',
//   planet: 'Zebulon',
//   invasionPlan: 'Take over Earth',
//   diplomaticSummary: 'Harmless envoy cover story'
// }
```

## Development setup

### Requirements

- Node.js 20+
- npm 10+ recommended

### Local install

```bash
npm install
```

### Run tests

```bash
npm test
```

### Watch tests

```bash
npm run test:watch
```

### Type-check only

```bash
npm run typecheck
```

### Build

```bash
npm run build
```

### Package check

```bash
npm pack
```

## API overview

### Primitive builders

```ts
expedition.string()
expedition.number()
expedition.boolean()
expedition.bigint()
expedition.date()
expedition.unknown()
expedition.literal('x')
expedition.enum(['a', 'b'])
expedition.fromZod(z.string().min(1))
```

### Composition

```ts
expedition.object({ ... })
expedition.array(node)
expedition.union([a, b])
```

### Mode assignment

```ts
expedition.string().modes(['public', 'internal'])
```

### Modifiers

```ts
expedition.string().modes(['public']).optional()
expedition.string().modes(['internal']).nullable()
expedition.object({ ... }).modes(['public']).array()
```

### Parse and dump

```ts
schema.parse(input, 'public')
schema.safeParse(input, 'public')
schema.dump(input, 'public')
schema.project('public')
```

## Design notes

This is **not** a literal transpilation of Python internals.

It is a native TypeScript reimplementation of the same semantic goal:

- single domain declaration
- projection at the model boundary
- consistent runtime validation
- safer outputs for APIs, logs, UIs, and LLM prompts

## Repository layout

```text
src/
  index.ts
examples/
  alien.ts
tests/
  basic.test.ts
```

## Limitations in this starter version

This starter implementation is intentionally small. It does **not** yet include:

- role-based policies beyond simple modes
- schema export helpers for OpenAPI / JSON Schema
- discriminated union helpers
- field-level audit explanations for why a field was excluded
- transform / refine pass-through helpers for every Zod API surface

Those are good next steps for a v2.
