// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyChoice, getAvailableChoices, getScene, resolveNextScene } from './engine';
import { parseEpisode, type Episode, type StoryState } from './schema';
import { enumeratePaths, validateEpisode } from './validator';

const episodeUrl = new URL('../content/last-online/season-1/episode-2.json', import.meta.url);
const initial: StoryState = { junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} };
const scores = ['junhoScore', 'taeyunScore', 'truthScore', 'riskScore'] as const;
const choiceSceneIds = ['ep2_recognized', 'ep2_photo_choice', 'ep2_archive_choice', 'ep2_rooftop_choice', 'ep2_card_choice'];

function loadEpisode(number: 1 | 2): Episode {
  return parseEpisode(JSON.parse(readFileSync(new URL(`../content/last-online/season-1/episode-${number}.json`, import.meta.url), 'utf8')));
}

function stateKey(state: StoryState): string {
  return JSON.stringify({ ...state, flags: Object.fromEntries(Object.entries(state.flags).sort(([a], [b]) => a.localeCompare(b))) });
}

const e1 = loadEpisode(1);
// Keep the original RED assertion useful if the content file is removed again.
const e2 = existsSync(episodeUrl) ? loadEpisode(2) : undefined;
function episode(): Episode {
  if (!e2) throw new Error('Episode 2 content is missing');
  return e2;
}

function campaignCoverage() {
  const firstPaths = enumeratePaths(e1, initial);
  const inheritedStates = [...new Map(firstPaths.map(path => [stateKey(path.state), path.state])).values()];
  const allSceneIds = new Set<string>();
  const allChoiceIds = new Set<string>();
  const errors = new Set<string>();
  const routeCounts = new Set<number>();
  const sequenceCounts = new Set<number>();
  let secondPathCount = 0;
  const byId = new Map(episode().scenes.map(scene => [scene.id, scene]));

  for (const inherited of inheritedStates) {
    const before = stateKey(inherited);
    const paths = enumeratePaths(episode(), inherited);
    const sequences = new Set<string>();
    routeCounts.add(paths.length);
    secondPathCount += paths.length;
    for (const path of paths) {
      if (!path.terminal || path.sceneIds.at(-1) !== 'ep2_end') errors.add(`unterminated: ${path.reason}`);
      for (const [key, value] of Object.entries(inherited.flags)) {
        if (path.state.flags[key] !== value) errors.add(`overwritten E1 flag: ${key}`);
      }
      const routeChoices: string[] = [];
      const expectedScores = { ...inherited };
      for (let i = 0; i < path.sceneIds.length; i++) {
        const id = path.sceneIds[i];
        allSceneIds.add(id);
        const scene = byId.get(id);
        if (!scene) { errors.add(`missing scene: ${id}`); continue; }
        if (scene.choices?.length) {
          const chosen = scene.choices.find(choice => choice.nextSceneId === path.sceneIds[i + 1]);
          if (!chosen) { errors.add(`missing option after ${id}`); continue; }
          routeChoices.push(chosen.id);
          allChoiceIds.add(chosen.id);
          for (const effect of chosen.effects ?? []) {
            if (effect.kind === 'inc') expectedScores[effect.score] += effect.by;
          }
        }
      }
      if (routeChoices.length !== 5) errors.add(`choice count: ${routeChoices.length}`);
      for (const score of scores) {
        if (expectedScores[score] !== path.state[score]) errors.add(`score reset: ${score}`);
      }
      sequences.add(routeChoices.join('|'));
    }
    sequenceCounts.add(sequences.size);
    if (before !== stateKey(inherited)) errors.add('mutated inherited state');
  }
  return { firstPaths, inheritedStates, allSceneIds, allChoiceIds, errors, routeCounts, sequenceCounts, secondPathCount };
}

it('ships the playable second episode', () => {
  expect(existsSync(episodeUrl)).toBe(true);
});

describe('Episode 2 narrative graph', () => {
  it('uses the existing schema, resolves every reference, and has one terminal cliffhanger', () => {
    const current = episode();
    expect(current.id).toBe('last-online-s1-e2');
    expect(current.title).toBe('Тот, кого все знают');
    expect(current.startSceneId).toBe('ep2_morning');
    expect(current.scenes).toHaveLength(53);
    expect(current.scenes.filter(scene => scene.kind === 'terminal').map(scene => scene.id)).toEqual(['ep2_end']);
    expect(validateEpisode(current)).toEqual([]);
    expect(new Set(current.requiredSceneIds)).toEqual(new Set(current.scenes.map(scene => scene.id)));
  });

  it('gives five decisions three available, distinct responses with score and flag consequences', () => {
    const current = episode();
    const decisions = current.scenes.filter(scene => scene.choices?.length);
    expect(decisions.map(scene => scene.id)).toEqual(choiceSceneIds);
    const allOptions = decisions.flatMap(scene => scene.choices!);
    expect(new Set(allOptions.map(option => option.id)).size).toBe(15);
    const originalFlags = new Set(e1.scenes.flatMap(scene => scene.choices ?? []).flatMap(choice => choice.effects ?? []).filter(effect => effect.kind === 'setFlag').map(effect => effect.flag));
    for (const scene of decisions) {
      expect(getAvailableChoices(scene, initial), scene.id).toHaveLength(3);
      expect(new Set(scene.choices!.map(choice => choice.nextSceneId)).size, scene.id).toBe(3);
      expect(new Set(scene.choices!.map(choice => getScene(current, choice.nextSceneId).text)).size, scene.id).toBe(3);
      for (const choice of scene.choices!) {
        expect(choice.effects?.some(effect => effect.kind === 'inc' && effect.by !== 0), choice.id).toBe(true);
        const flags = choice.effects?.filter(effect => effect.kind === 'setFlag') ?? [];
        expect(flags.length, choice.id).toBeGreaterThan(0);
        for (const effect of flags) expect(originalFlags.has(effect.flag), choice.id).toBe(false);
        const after = applyChoice(initial, choice);
        expect(after).not.toEqual(initial);
        expect(initial.flags).toEqual({});
      }
    }
    expect(new Set(allOptions.flatMap(choice => choice.effects ?? []).filter(effect => effect.kind === 'inc').map(effect => effect.score))).toEqual(new Set(scores));
  });

  it('terminates all 39,366 E1→E2 routes and reaches every scene and option without losing inherited state', () => {
    const coverage = campaignCoverage();
    expect(coverage.firstPaths).toHaveLength(162);
    expect(coverage.firstPaths.every(path => path.terminal)).toBe(true);
    expect(coverage.inheritedStates).toHaveLength(162);
    expect([...coverage.errors]).toEqual([]);
    expect([...coverage.routeCounts]).toEqual([243]);
    expect([...coverage.sequenceCounts]).toEqual([243]);
    expect(coverage.secondPathCount).toBe(39_366);
    expect(coverage.allSceneIds).toEqual(new Set(episode().scenes.map(scene => scene.id)));
    expect(coverage.allChoiceIds.size).toBe(15);
  }, 20_000);

  it('also has 243 distinct complete routes from a neutral standalone initial state', () => {
    const paths = enumeratePaths(episode(), initial);
    expect(paths).toHaveLength(243);
    expect(new Set(paths.map(path => choiceSceneIds.map(id => {
      const index = path.sceneIds.indexOf(id);
      return path.sceneIds[index + 1];
    }).join('|'))).size).toBe(243);
    expect(paths.every(path => path.terminal && path.sceneIds.at(-1) === 'ep2_end')).toBe(true);
  });

  it.each([
    ['ep2_morning', 'photo_called_junho', 'ep2_morning_called'],
    ['ep2_morning', 'photo_replied_soa', 'ep2_morning_replied'],
    ['ep2_morning', 'photo_saved', 'ep2_morning_saved'],
    ['ep2_hall', 'trusted_junho_warning', 'ep2_hall_trust'],
    ['ep2_hall', 'evaded_junho', 'ep2_hall_evaded'],
    ['ep2_soa_history', 'told_junho_soa', 'ep2_soa_told'],
    ['ep2_soa_history', 'hid_soa_message', 'ep2_soa_hidden'],
    ['ep2_soa_history', 'replied_soa', 'ep2_soa_replied'],
    ['ep2_archive_reflection', 'deep_scandal_search', 'ep2_archive_deep'],
  ])('uses inherited %s / %s to choose actual dialogue %s', (sceneId, flag, target) => {
    const state = { ...initial, flags: { [flag]: true } };
    const scene = getScene(episode(), sceneId);
    expect(scene.transitions?.some(transition => transition.conditions?.some(condition => condition.kind === 'flagEquals' && condition.flag === flag))).toBe(true);
    expect(resolveNextScene(scene, state)).toBe(target);
    const targetText = getScene(episode(), target).text;
    const siblings = new Set([scene.nextSceneId, ...scene.transitions!.map(transition => transition.nextSceneId)]);
    for (const id of siblings) if (id && id !== target) expect(getScene(episode(), id).text).not.toBe(targetText);
  });

  it('changes Junho’s intervention at the inherited relationship threshold', () => {
    for (const id of ['ep2_rooftop_believe', 'ep2_rooftop_suspect', 'ep2_rooftop_junho']) {
      const scene = getScene(episode(), id);
      expect(resolveNextScene(scene, { ...initial, junhoScore: 3 })).toBe('ep2_junho_distant');
      expect(resolveNextScene(scene, { ...initial, junhoScore: 4 })).toBe('ep2_junho_close');
    }
    expect(getScene(episode(), 'ep2_junho_close').text).toContain('Спасибо, что сказала сама');
    expect(getScene(episode(), 'ep2_junho_distant').text).toContain('Если ты опять ограничишься запретом');
  });
});

describe('Episode 2 visual and continuity contract', () => {
  it('has 2–7 short individually directed beats, readable source text, and explicit scene direction throughout', () => {
    let beatCount = 0;
    for (const scene of episode().scenes) {
      expect(scene.beats?.length, scene.id).toBeGreaterThanOrEqual(2);
      expect(scene.beats?.length, scene.id).toBeLessThanOrEqual(7);
      expect(scene.presentation?.location, scene.id).toBeTruthy();
      expect(scene.presentation?.camera, scene.id).toBeTruthy();
      expect(scene.background, scene.id).toBeTruthy();
      for (const beat of scene.beats!) {
        beatCount++;
        expect(beat.text.length, `${scene.id}: ${beat.text}`).toBeLessThanOrEqual(220);
        expect(beat.presentation?.camera, scene.id).toBeTruthy();
        expect(beat.presentation?.motion, scene.id).toBeTruthy();
        expect(beat.text).not.toMatch(/^(Лера|Тэюн|Джунхо|Мина|SOA):/u);
        expect(scene.text, scene.id).toContain(beat.text);
      }
    }
    expect(beatCount).toBe(243);
  });

  it('uses all seven Taeyun poses, five separate CGs, and supported original asset paths', () => {
    const states = new Set<string>();
    const cgs = new Set<string>();
    const assets = new Set<string>();
    for (const scene of episode().scenes) {
      if (scene.background) assets.add(scene.background);
      if (scene.attachment) assets.add(scene.attachment);
      for (const direction of [scene.presentation, ...scene.beats!.map(beat => beat.presentation)]) {
        if (direction?.cg) {
          cgs.add(direction.cg);
          assets.add(direction.cg);
          expect(direction.characters, scene.id).toEqual([]);
        }
        for (const character of direction?.characters ?? []) {
          assets.add(character.src);
          expect(character.pose, scene.id).toBeTruthy();
          expect(character.position, scene.id).toBeTruthy();
          if (character.id === 'taeyun') states.add(character.emotion);
        }
      }
    }
    expect(states).toEqual(new Set(['neutral', 'stage', 'amused', 'guarded', 'serious', 'surprised', 'vulnerable']));
    expect([...cgs].map(path => path.split('/').at(-1)).sort()).toEqual(['archive-0226.webp', 'elevator-cliffhanger.webp', 'elevator-hand.webp', 'night-access-v2.webp', 'recognized-number-v2.webp']);
    for (const path of assets) {
      expect(path).toMatch(/^assets\/last-online\/(?:v2|ep2)\/(?:backgrounds|characters|cg)\/[a-z0-9/-]+\.webp$/);
      // Episode 2 art is produced independently; its delivery is asserted by the asset manifest suite.
      if (path.includes('/v2/')) expect(existsSync(new URL(`../../public/${path}`, import.meta.url)), path).toBe(true);
    }
  });

  it('presents the SOA warnings as sequential incoming and outgoing messenger events', () => {
    const first = getScene(episode(), 'ep2_soa_incoming');
    const reply = getScene(episode(), 'ep2_soa_outgoing');
    const warning = getScene(episode(), 'ep2_soa_door');
    expect(first.nextSceneId).toBe(reply.id);
    expect(first.chat?.messages).toContainEqual({ from: 'soa', text: 'Он хорошо помнит время. Спроси, почему он был рядом.', meta: undefined });
    expect(reply.chat?.messages.map(message => message.from)).toEqual(['lera', 'soa', 'lera', 'system']);
    expect(warning.chat?.messages[0].text).toBe('Не открывай дверь, если Тэюн рядом.');
    expect(warning.chat?.messages.map(message => message.from)).toEqual(['soa', 'lera', 'soa', 'system']);
    for (const scene of episode().scenes.filter(candidate => candidate.chat)) {
      expect(scene.kind).toBe('message');
      expect(scene.presentation?.mode).toBe('phone');
      expect(scene.presentation?.characters).toEqual([]);
      expect(scene.chat?.messages.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps the card with a named holder across take, refuse, and photograph routes', () => {
    const checkpoint = getScene(episode(), 'ep2_lift_checkpoint');
    expect(resolveNextScene(checkpoint, { ...initial, flags: { ep2_card_response: 'take' } })).toBe('ep2_lift_yours');
    for (const option of ['refuse', 'send']) {
      expect(resolveNextScene(checkpoint, { ...initial, flags: { ep2_card_response: option } })).toBe('ep2_lift_his');
    }
    expect(getScene(episode(), 'ep2_card_refuse').text).toContain('Карту храню я');
    expect(getScene(episode(), 'ep2_card_send').text).toContain('возвращает пропуск Тэюну');
    expect(getScene(episode(), 'ep2_lift_yours').text).toContain('протягивает карту Тэюну');
    expect(getScene(episode(), 'ep2_lift_his').text).toContain('не прячет её');
    expect(getScene(episode(), 'ep2_confrontation').beats?.filter(beat => beat.speaker).map(beat => [beat.speaker, beat.text])).toEqual([
      ['Джунхо', 'Отдай ей это.'], ['Тэюн', 'Ты опоздал на три года.'],
    ]);
  });
});
