import { describe, expect, it } from 'vitest';
import { applyChoice, getAvailableChoices, getScene, resolveNextScene } from './engine';
import type { Choice, Episode, StoryState } from './schema';

const initial: StoryState = {
  junhoScore: 0,
  taeyunScore: 0,
  truthScore: 0,
  riskScore: 0,
  flags: {},
};

const choice: Choice = {
  id: 'trust',
  text: 'Довериться',
  nextSceneId: 's2',
  effects: [
    { kind: 'inc', score: 'junhoScore', by: 2 },
    { kind: 'setFlag', flag: 'trusted_junho', value: true },
  ],
};

it('applies score and flag effects immutably', () => {
  const next = applyChoice(initial, choice);
  expect(next.junhoScore).toBe(initial.junhoScore + 2);
  expect(next.flags.trusted_junho).toBe(true);
  expect(initial.junhoScore).toBe(0);
  expect(initial.flags.trusted_junho).toBeUndefined();
});

it('filters choices whose conditions are not met', () => {
  const scene = {
    id: 's1', kind: 'dialogue' as const, text: '...', choices: [
      choice,
      { id: 'secret', text: 'Сказать правду', nextSceneId: 's3', conditions: [{ kind: 'scoreAtLeast' as const, score: 'truthScore' as const, value: 2 }] },
    ],
  };
  expect(getAvailableChoices(scene, initial).map((item) => item.id)).toEqual(['trust']);
  expect(getAvailableChoices(scene, { ...initial, truthScore: 2 }).map((item) => item.id)).toEqual(['trust', 'secret']);
});

it('resolves conditional transition before fallback transition', () => {
  const scene = {
    id: 's1', kind: 'narrative' as const, text: '...', nextSceneId: 'fallback',
    transitions: [{ nextSceneId: 'romance', conditions: [{ kind: 'flagEquals' as const, flag: 'trusted_junho', value: true }] }],
  };
  expect(resolveNextScene(scene, initial)).toBe('fallback');
  expect(resolveNextScene(scene, { ...initial, flags: { trusted_junho: true } })).toBe('romance');
});

it('gets scenes and terminal scenes resolve to null', () => {
  const episode: Episode = { id: 'ep', title: 'Mini', startSceneId: 'end', scenes: [{ id: 'end', kind: 'terminal', text: 'Конец' }] };
  const scene = getScene(episode, 'end');
  expect(scene.kind).toBe('terminal');
  expect(resolveNextScene(scene, initial)).toBeNull();
});
