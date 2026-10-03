export type ScoreName = 'junhoScore' | 'taeyunScore' | 'truthScore' | 'riskScore';
export type FlagValue = boolean | string | number;

export type StoryState = {
  junhoScore: number;
  taeyunScore: number;
  truthScore: number;
  riskScore: number;
  flags: Record<string, FlagValue>;
};

export type Condition =
  | { kind: 'scoreAtLeast'; score: ScoreName; value: number }
  | { kind: 'flagEquals'; flag: string; value: FlagValue };

export type Effect =
  | { kind: 'inc'; score: ScoreName; by: number }
  | { kind: 'setFlag'; flag: string; value: FlagValue };

export type Choice = {
  id: string;
  text: string;
  nextSceneId: string;
  conditions?: Condition[];
  effects?: Effect[];
};

export type Transition = {
  nextSceneId: string;
  conditions?: Condition[];
};

export type SceneKind = 'narrative' | 'dialogue' | 'message' | 'terminal';
export type ChatMessageFrom = 'soa' | 'lera' | 'system';

export type ChatMessage = {
  from: ChatMessageFrom;
  text: string;
  meta?: string;
};

export type ChatPresentation = {
  status?: string;
  typing?: boolean;
  context?: string;
  messages: ChatMessage[];
};

export type CharacterPresentation = {
  id: string; src: string; emotion: string; pose?: string;
  position?: 'left' | 'center' | 'right';
  depth?: 'foreground' | 'background';
  framing?: 'close-up' | 'medium' | 'full-body';
};
export type ScenePresentation = {
  mode?: 'standard' | 'cinematic' | 'phone';
  location?: string;
  camera?: 'wide' | 'medium' | 'close' | 'extreme-close';
  position?: 'left' | 'center' | 'right';
  motion?: 'none' | 'slow-zoom' | 'push-in' | 'pull-out' | 'drift-left' | 'drift-right' | 'tension' | 'reveal' | 'shake';
  transition?: 'fade' | 'crossfade' | 'cut';
  effect?: 'none' | 'flash' | 'dark-pulse';
  ambient?: 'none' | 'rain' | 'dust';
  cg?: string;
  characters?: CharacterPresentation[];
  haptic?: 'light' | 'medium';
  sound?: string;
};
export type Beat = { text: string; speaker?: string; background?: string; presentation?: ScenePresentation; delay?: number };

export type Scene = {
  id: string;
  kind: SceneKind;
  text: string;
  speaker?: string;
  background?: string;
  character?: string;
  attachment?: string;
  chat?: ChatPresentation;
  beats?: Beat[];
  presentation?: ScenePresentation;
  choices?: Choice[];
  transitions?: Transition[];
  nextSceneId?: string;
};

export type Episode = {
  id: string;
  title: string;
  startSceneId: string;
  requiredSceneIds?: string[];
  scenes: Scene[];
};

export class StorySchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorySchemaError';
  }
}

const SCORE_NAMES = new Set<ScoreName>(['junhoScore', 'taeyunScore', 'truthScore', 'riskScore']);
const SCENE_KINDS = new Set<SceneKind>(['narrative', 'dialogue', 'message', 'terminal']);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new StorySchemaError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new StorySchemaError(`${label} must be a non-empty string`);
  }
  return value;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new StorySchemaError(`${label} must be a finite number`);
  }
  return value;
}

function flagValue(value: unknown, label: string): FlagValue {
  if (typeof value !== 'boolean' && typeof value !== 'string' && typeof value !== 'number') {
    throw new StorySchemaError(`${label} must be boolean, string, or number`);
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new StorySchemaError(`${label} must be finite`);
  }
  return value;
}

function scoreName(value: unknown, label: string): ScoreName {
  if (typeof value !== 'string' || !SCORE_NAMES.has(value as ScoreName)) {
    throw new StorySchemaError(`${label} contains unknown score ${String(value)}`);
  }
  return value as ScoreName;
}

function parseCondition(raw: unknown, label: string): Condition {
  const value = record(raw, label);
  if (value.kind === 'scoreAtLeast') {
    return {
      kind: 'scoreAtLeast',
      score: scoreName(value.score, `${label}.score`),
      value: finiteNumber(value.value, `${label}.value`),
    };
  }
  if (value.kind === 'flagEquals') {
    return {
      kind: 'flagEquals',
      flag: stringValue(value.flag, `${label}.flag`),
      value: flagValue(value.value, `${label}.value`),
    };
  }
  throw new StorySchemaError(`${label}.kind is unknown: ${String(value.kind)}`);
}

function parseConditions(raw: unknown, label: string): Condition[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) throw new StorySchemaError(`${label} must be an array`);
  return raw.map((item, index) => parseCondition(item, `${label}[${index}]`));
}

function parseEffect(raw: unknown, label: string): Effect {
  const value = record(raw, label);
  if (value.kind === 'inc') {
    return {
      kind: 'inc',
      score: scoreName(value.score, `${label}.score`),
      by: finiteNumber(value.by, `${label}.by`),
    };
  }
  if (value.kind === 'setFlag') {
    return {
      kind: 'setFlag',
      flag: stringValue(value.flag, `${label}.flag`),
      value: flagValue(value.value, `${label}.value`),
    };
  }
  throw new StorySchemaError(`${label}.kind is unknown: ${String(value.kind)}`);
}

function parseChoice(raw: unknown, label: string): Choice {
  const value = record(raw, label);
  const effectsRaw = value.effects;
  if (effectsRaw !== undefined && !Array.isArray(effectsRaw)) {
    throw new StorySchemaError(`${label}.effects must be an array`);
  }
  const effects = Array.isArray(effectsRaw)
    ? effectsRaw.map((item, index) => parseEffect(item, `${label}.effects[${index}]`))
    : undefined;
  return {
    id: stringValue(value.id, `${label}.id`),
    text: stringValue(value.text, `${label}.text`),
    nextSceneId: stringValue(value.nextSceneId, `${label}.nextSceneId`),
    conditions: parseConditions(value.conditions, `${label}.conditions`),
    effects,
  };
}

function parseTransition(raw: unknown, label: string): Transition {
  const value = record(raw, label);
  return {
    nextSceneId: stringValue(value.nextSceneId, `${label}.nextSceneId`),
    conditions: parseConditions(value.conditions, `${label}.conditions`),
  };
}


const CHAT_MESSAGE_FROM = new Set<ChatMessageFrom>(['soa', 'lera', 'system']);

function parseChat(raw: unknown, label: string): ChatPresentation | undefined {
  if (raw === undefined) return undefined;
  const value = record(raw, label);
  if (!Array.isArray(value.messages)) {
    throw new StorySchemaError(`${label}.messages must be an array`);
  }
  const messages = value.messages.map((item, index) => {
    const message = record(item, `${label}.messages[${index}]`);
    if (typeof message.from !== 'string' || !CHAT_MESSAGE_FROM.has(message.from as ChatMessageFrom)) {
      throw new StorySchemaError(`${label}.messages[${index}].from is unknown: ${String(message.from)}`);
    }
    return {
      from: message.from as ChatMessageFrom,
      text: stringValue(message.text, `${label}.messages[${index}].text`),
      meta: message.meta === undefined
        ? undefined
        : stringValue(message.meta, `${label}.messages[${index}].meta`),
    };
  });
  if (value.typing !== undefined && typeof value.typing !== 'boolean') {
    throw new StorySchemaError(`${label}.typing must be boolean`);
  }
  return {
    status: value.status === undefined ? undefined : stringValue(value.status, `${label}.status`),
    context: value.context === undefined ? undefined : stringValue(value.context, `${label}.context`),
    typing: value.typing === undefined ? undefined : value.typing,
    messages,
  };
}

function enumValue<T extends string>(raw: unknown, values: readonly T[], label: string): T | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !values.includes(raw as T)) throw new StorySchemaError(`${label} is unknown: ${String(raw)}`);
  return raw as T;
}
function parsePresentation(raw: unknown, label: string): ScenePresentation | undefined {
  if (raw === undefined) return undefined;
  const v = record(raw, label);
  if (v.characters !== undefined && !Array.isArray(v.characters)) throw new StorySchemaError(`${label}.characters must be an array`);
  return {
    mode: enumValue(v.mode, ['standard', 'cinematic', 'phone'], `${label}.mode`),
    camera: enumValue(v.camera, ['wide', 'medium', 'close', 'extreme-close'], `${label}.camera`),
    position: enumValue(v.position, ['left', 'center', 'right'], `${label}.position`),
    motion: enumValue(v.motion, ['none', 'slow-zoom', 'push-in', 'pull-out', 'drift-left', 'drift-right', 'tension', 'reveal', 'shake'], `${label}.motion`),
    transition: enumValue(v.transition, ['fade', 'crossfade', 'cut'], `${label}.transition`),
    effect: enumValue(v.effect, ['none', 'flash', 'dark-pulse'], `${label}.effect`),
    ambient: enumValue(v.ambient, ['none', 'rain', 'dust'], `${label}.ambient`),
    haptic: enumValue(v.haptic, ['light', 'medium'], `${label}.haptic`),
    ...Object.fromEntries(['location', 'cg', 'sound'].filter(k => v[k] !== undefined).map(k => [k, stringValue(v[k], `${label}.${k}`)])),
    characters: Array.isArray(v.characters) ? v.characters.map((rawCharacter, i) => {
      const c = record(rawCharacter, `${label}.characters[${i}]`);
      return {
        id: stringValue(c.id, `${label}.character.id`), src: stringValue(c.src, `${label}.character.src`),
        emotion: stringValue(c.emotion, `${label}.character.emotion`),
        pose: c.pose === undefined ? undefined : stringValue(c.pose, `${label}.character.pose`),
        position: enumValue(c.position, ['left', 'center', 'right'], `${label}.character.position`),
        depth: enumValue(c.depth, ['foreground', 'background'], `${label}.character.depth`),
        framing: enumValue(c.framing, ['close-up', 'medium', 'full-body'], `${label}.character.framing`),
      };
    }) : undefined,
  };
}
function parseBeats(raw: unknown, label: string): Beat[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length === 0) throw new StorySchemaError(`${label} must be a non-empty array`);
  return raw.map((item, i) => {
    const v = record(item, `${label}[${i}]`);
    const delay = v.delay === undefined ? undefined : finiteNumber(v.delay, `${label}.delay`);
    if (delay !== undefined && (delay < 0 || delay > 2000)) throw new StorySchemaError(`${label}.delay must be between 0 and 2000`);
    return {
      text: stringValue(v.text, `${label}.text`),
      speaker: v.speaker === undefined ? undefined : stringValue(v.speaker, `${label}.speaker`),
      background: v.background === undefined ? undefined : stringValue(v.background, `${label}.background`),
      presentation: parsePresentation(v.presentation, `${label}.presentation`), delay,
    };
  });
}

function parseScene(raw: unknown, index: number): Scene {
  const label = `scenes[${index}]`;
  const value = record(raw, label);
  if (typeof value.kind !== 'string' || !SCENE_KINDS.has(value.kind as SceneKind)) {
    throw new StorySchemaError(`${label}.kind is unknown: ${String(value.kind)}`);
  }
  const choicesRaw = value.choices;
  const transitionsRaw = value.transitions;
  if (choicesRaw !== undefined && !Array.isArray(choicesRaw)) {
    throw new StorySchemaError(`${label}.choices must be an array`);
  }
  if (transitionsRaw !== undefined && !Array.isArray(transitionsRaw)) {
    throw new StorySchemaError(`${label}.transitions must be an array`);
  }
  const choices = Array.isArray(choicesRaw)
    ? choicesRaw.map((item, choiceIndex) => parseChoice(item, `${label}.choices[${choiceIndex}]`))
    : undefined;
  const transitions = Array.isArray(transitionsRaw)
    ? transitionsRaw.map((item, transitionIndex) => parseTransition(item, `${label}.transitions[${transitionIndex}]`))
    : undefined;
  return {
    id: stringValue(value.id, `${label}.id`),
    kind: value.kind as SceneKind,
    text: stringValue(value.text, `${label}.text`),
    speaker: value.speaker === undefined ? undefined : stringValue(value.speaker, `${label}.speaker`),
    background: value.background === undefined ? undefined : stringValue(value.background, `${label}.background`),
    character: value.character === undefined ? undefined : stringValue(value.character, `${label}.character`),
    attachment: value.attachment === undefined ? undefined : stringValue(value.attachment, `${label}.attachment`),
    chat: parseChat(value.chat, `${label}.chat`),
    beats: parseBeats(value.beats, `${label}.beats`),
    presentation: parsePresentation(value.presentation, `${label}.presentation`),
    choices,
    transitions,
    nextSceneId: value.nextSceneId === undefined ? undefined : stringValue(value.nextSceneId, `${label}.nextSceneId`),
  };
}

export function parseEpisode(raw: unknown): Episode {
  const value = record(raw, 'episode');
  if (!Array.isArray(value.scenes) || value.scenes.length === 0) {
    throw new StorySchemaError('episode.scenes must be a non-empty array');
  }
  const scenes = value.scenes.map(parseScene);
  const ids = new Set<string>();
  for (const scene of scenes) {
    if (ids.has(scene.id)) throw new StorySchemaError(`duplicate scene id: ${scene.id}`);
    ids.add(scene.id);
  }

  let requiredSceneIds: string[] | undefined;
  if (value.requiredSceneIds !== undefined) {
    if (!Array.isArray(value.requiredSceneIds)) {
      throw new StorySchemaError('episode.requiredSceneIds must be an array');
    }
    requiredSceneIds = value.requiredSceneIds.map((item, index) =>
      stringValue(item, `episode.requiredSceneIds[${index}]`));
  }

  return {
    id: stringValue(value.id, 'episode.id'),
    title: stringValue(value.title, 'episode.title'),
    startSceneId: stringValue(value.startSceneId, 'episode.startSceneId'),
    requiredSceneIds,
    scenes,
  };
}
