import { describe, expect, it } from 'vitest';
import { expedition } from '../src/index.js';

const Alien = expedition.object({
  species: expedition.string().modes(['public', 'llm', 'internal']),
  planet: expedition.string().modes(['public', 'llm', 'internal']),
  missionCode: expedition.string().modes(['internal']).optional(),
  invasionPlan: expedition.string().modes(['internal']),
  diplomaticSummary: expedition.string().modes(['llm', 'internal']).optional(),
  nest: expedition.object({
    sector: expedition.string().modes(['internal']),
    visibleSector: expedition.string().modes(['public', 'llm', 'internal'])
  }).modes(['public', 'llm', 'internal']),
  sightings: expedition.array(
    expedition.object({
      city: expedition.string().modes(['public', 'llm', 'internal']),
      witnessName: expedition.string().modes(['internal'])
    }).modes(['public', 'llm', 'internal'])
  ).modes(['public', 'llm', 'internal'])
}).modes(['public', 'llm', 'internal']);

describe('titanic-expedition', () => {
  const fullAlien = {
    species: 'Xylar',
    planet: 'Zebulon',
    missionCode: 'A-17',
    invasionPlan: 'Arrive hidden in source maps',
    diplomaticSummary: 'Friendly cover story for model context',
    nest: {
      sector: 'Black Vault',
      visibleSector: 'Outer Rim'
    },
    sightings: [
      { city: 'Brisbane', witnessName: 'Casey' },
      { city: 'Sydney', witnessName: 'Jordan' }
    ],
    ignoredByDefault: 'should be stripped'
  };

  it('projects public mode safely', () => {
    const projected = Alien.dump(fullAlien, 'public');
    expect(projected).toEqual({
      species: 'Xylar',
      planet: 'Zebulon',
      nest: {
        visibleSector: 'Outer Rim'
      },
      sightings: [
        { city: 'Brisbane' },
        { city: 'Sydney' }
      ]
    });
  });

  it('projects llm mode differently from public mode', () => {
    const projected = Alien.dump(fullAlien, 'llm');
    expect(projected).toEqual({
      species: 'Xylar',
      planet: 'Zebulon',
      diplomaticSummary: 'Friendly cover story for model context',
      nest: {
        visibleSector: 'Outer Rim'
      },
      sightings: [
        { city: 'Brisbane' },
        { city: 'Sydney' }
      ]
    });
  });

  it('keeps internal-only fields for internal mode', () => {
    const projected = Alien.dump(fullAlien, 'internal');
    expect(projected).toEqual({
      species: 'Xylar',
      planet: 'Zebulon',
      missionCode: 'A-17',
      invasionPlan: 'Arrive hidden in source maps',
      diplomaticSummary: 'Friendly cover story for model context',
      nest: {
        sector: 'Black Vault',
        visibleSector: 'Outer Rim'
      },
      sightings: [
        { city: 'Brisbane', witnessName: 'Casey' },
        { city: 'Sydney', witnessName: 'Jordan' }
      ]
    });
  });

  it('can validate a projected schema directly', () => {
    const publicSchema = Alien.project('public');
    const parsed = publicSchema.parse({
      species: 'Xylar',
      planet: 'Zebulon',
      nest: { visibleSector: 'Outer Rim', sector: 'ignored' },
      sightings: [{ city: 'Brisbane', witnessName: 'ignored' }],
      invasionPlan: 'should be stripped'
    });

    expect(parsed).toEqual({
      species: 'Xylar',
      planet: 'Zebulon',
      nest: { visibleSector: 'Outer Rim' },
      sightings: [{ city: 'Brisbane' }]
    });
  });

  it('supports unions with mode-aware members', () => {
    const Payload = expedition.union([
      expedition.object({
        kind: expedition.literal('public').modes(['public', 'internal']),
        summary: expedition.string().modes(['public', 'internal'])
      }).modes(['public', 'internal']),
      expedition.object({
        kind: expedition.literal('internal').modes(['internal']),
        trace: expedition.string().modes(['internal'])
      }).modes(['internal'])
    ]).modes(['public', 'internal']);

    expect(Payload.dump({ kind: 'public', summary: 'ok' }, 'public')).toEqual({ kind: 'public', summary: 'ok' });
    expect(Payload.dump({ kind: 'internal', trace: 'full audit trail' }, 'internal')).toEqual({ kind: 'internal', trace: 'full audit trail' });
  });

  it('can keep unknown keys when asked', () => {
    const parsed = Alien.parse(fullAlien, 'public', { stripUnknown: false }) as Record<string, unknown>;
    expect(parsed.ignoredByDefault).toBe('should be stripped');
  });
});
