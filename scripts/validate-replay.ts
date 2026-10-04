import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { EPISODE_REWIND_TARGETS } from '../supabase/functions/lumi-api/rewind-targets.ts';

type RawEpisode = {
  id: string;
  startSceneId: string;
  scenes: Array<{ id: string; kind: string }>;
};

const root = join(process.cwd(), 'src', 'content');
const episodeFiles: string[] = [];

function walk(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/episode-\d+\.json$/.test(entry.name)) episodeFiles.push(path);
  }
}

walk(root);

const seen = new Set<string>();
for (const file of episodeFiles) {
  const parts = relative(root, file).split(sep);
  if (parts.length < 3) throw new Error('Unexpected episode path: ' + file);
  const [storyId, seasonId] = parts;
  const episode = JSON.parse(readFileSync(file, 'utf8')) as RawEpisode;
  const idMatch = /-s(\d+)-e(\d+)$/.exec(episode.id);
  if (!idMatch) throw new Error('Replay requires canonical episode id: ' + episode.id);
  const expectedSeasonId = 'season-' + idMatch[1];
  if (seasonId !== expectedSeasonId) {
    throw new Error(episode.id + ': season folder does not match episode id');
  }

  const target = EPISODE_REWIND_TARGETS[episode.id as keyof typeof EPISODE_REWIND_TARGETS];
  if (!target) throw new Error(episode.id + ': missing replay target');
  seen.add(episode.id);

  const terminalSceneIds = episode.scenes
    .filter(scene => scene.kind === 'terminal')
    .map(scene => scene.id)
    .sort();
  const configuredTerminalIds = [...target.terminalSceneIds].sort();

  if (target.storyId !== storyId) throw new Error(episode.id + ': replay storyId mismatch');
  if (target.seasonId !== seasonId) throw new Error(episode.id + ': replay seasonId mismatch');
  if (target.index !== Number(idMatch[2]) - 1) throw new Error(episode.id + ': replay episode index mismatch');
  if (target.startSceneId !== episode.startSceneId) throw new Error(episode.id + ': replay start scene mismatch');
  if (JSON.stringify(configuredTerminalIds) !== JSON.stringify(terminalSceneIds)) {
    throw new Error(episode.id + ': replay terminal scenes mismatch');
  }
}

for (const episodeId of Object.keys(EPISODE_REWIND_TARGETS)) {
  if (!seen.has(episodeId)) throw new Error(episodeId + ': replay target has no published episode');
}

console.log('Replay coverage OK for ' + seen.size + ' published episodes.');
