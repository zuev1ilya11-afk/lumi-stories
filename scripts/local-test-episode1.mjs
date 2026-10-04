import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const episodePath = join(root, 'src/content/last-online/season-1/episode-1.json');
const assetsPath = join(root, 'src/content/last-online/season-1/episode-1.assets.json');
const out = mkdtempSync(join(tmpdir(), 'lumi-episode1-'));
const initial = { junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} };

function assert(ok, message) { if (!ok) throw new Error(message); }

try {
  const raw = JSON.parse(readFileSync(episodePath, 'utf8'));
  const assets = JSON.parse(readFileSync(assetsPath, 'utf8'));
  const sources = ['src/story/schema.ts', 'src/story/engine.ts', 'src/story/validator.ts'].map((p) => join(root, p));
  execFileSync('tsc', [...sources, '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'bundler', '--lib', 'ES2022,DOM,DOM.Iterable', '--skipLibCheck', '--outDir', out, '--rewriteRelativeImportExtensions'], { stdio: 'inherit' });
  const schema = await import(pathToFileURL(join(out, 'schema.js')).href + `?v=${Date.now()}`);
  const validator = await import(pathToFileURL(join(out, 'validator.js')).href + `?v=${Date.now()}`);
  const episode = schema.parseEpisode(raw);
  const issues = validator.validateEpisode(episode);
  assert(issues.length === 0, `validation issues: ${JSON.stringify(issues)}`);

  const choiceNodeIds = ['ep1_choice_first_impression','ep1_choice_search_scandal','ep1_choice_soa_message','ep1_choice_junho_confrontation','ep1_choice_photo_response'];
  const choiceNodes = choiceNodeIds.map((id) => episode.scenes.find((scene) => scene.id === id));
  assert(choiceNodes.every(Boolean), 'all five required choice nodes must exist');
  assert(choiceNodes.every((scene) => scene.choices?.length >= 2), 'all required choice nodes must contain choices');

  const soa = episode.scenes.find((scene) => scene.id === 'ep1_choice_soa_message');
  assert(soa.choices.length === 3, 'SOA choice must contain exactly 3 options');
  const flags = soa.choices.flatMap((choice) => (choice.effects ?? []).filter((e) => e.kind === 'setFlag').map((e) => e.flag)).sort();
  assert(JSON.stringify(flags) === JSON.stringify(['hid_soa_message','replied_soa','told_junho_soa']), `unexpected SOA flags: ${flags}`);

  const paths = validator.enumeratePaths(episode, initial);
  assert(paths.length > 1, 'episode must have branching paths');
  assert(paths.every((p) => p.terminal && p.sceneIds.at(-1) === 'ep1_end_paywall'), 'every path must terminate at ep1_end_paywall');
  const states = new Set(paths.map((p) => `${p.state.junhoScore}:${p.state.truthScore}`));
  assert(states.size >= 2, 'final paths must produce at least two distinct junho/truth score states');

  const assetIds = new Set([...(assets.backgrounds ?? []), ...(assets.characters ?? []), ...(assets.cg ?? [])].map((x) => typeof x === 'string' ? x : x.id));
  for (const scene of episode.scenes) {
    if (scene.background) assert(assetIds.has(scene.background), `unknown background asset ${scene.background} in ${scene.id}`);
    if (scene.character) assert(assetIds.has(scene.character), `unknown character asset ${scene.character} in ${scene.id}`);
  }
  assert(assetIds.has('soa-junho-old-photo'), 'required CG soa-junho-old-photo missing');
  console.log(`PASS: episode 1 content contracts (${episode.scenes.length} scenes, ${paths.length} paths)`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
