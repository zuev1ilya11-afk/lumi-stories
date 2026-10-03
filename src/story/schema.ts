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
  messages: ChatMessage[];
};

export type Scene = {
  id: string;
  kind: SceneKind;
  text: string;
  speaker?: string;
  background?: string;
  character?: string;
  attachment?: string;
  chat?: ChatPresentation;
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
    typing: value.typing === undefined ? undefined : value.typing,
    messages,
  };
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
