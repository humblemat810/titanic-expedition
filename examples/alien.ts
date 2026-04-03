import { expedition } from '../src/index.js';

const Alien = expedition.object({
  species: expedition.string().modes(['public', 'llm', 'internal']),
  planet: expedition.string().modes(['public', 'llm', 'internal']),
  invasionPlan: expedition.string().modes(['internal']),
  diplomaticSummary: expedition.string().modes(['llm', 'internal']).optional()
}).modes(['public', 'llm', 'internal']);

const raw = {
  species: 'Xylar',
  planet: 'Zebulon',
  invasionPlan: 'Take over Earth',
  diplomaticSummary: 'Harmless envoy cover story'
};

console.log('public', Alien.dump(raw, 'public'));
console.log('llm', Alien.dump(raw, 'llm'));
console.log('internal', Alien.dump(raw, 'internal'));
