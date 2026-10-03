import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const out = mkdtempSync(join(tmpdir(), 'lumi-story-'));
const initial = { junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} };
try {
  const sources = ['src/story/schema.ts', 'src/story/engine.ts', 'src/story/validator.ts'].map((p) => join(root, p));
  execFileSync('tsc', [...sources, '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'bundler', '--lib', 'ES2022,DOM,DOM.Iterable', '--skipLibCheck', '--outDir', out, '--rewriteRelativeImportExtensions'], { stdio: 'inherit' });
  const schema = await import(pathToFileURL(join(out, 'schema.js')).href + `?v=${Date.now()}`);
  const engine = await import(pathToFileURL(join(out, 'engine.js')).href + `?v=${Date.now()}`);
  const validator = await import(pathToFileURL(join(out, 'validator.js')).href + `?v=${Date.now()}`);

  const rejected = [
    { id: 'x', title: 'x', startSceneId: 's', scenes: [{ id: 's', kind: 'video', text: 'x' }] },
    { id: 'x', title: 'x', startSceneId: 's', scenes: [{ id: 's', kind: 'dialogue', text: 'x', choices: [{ id: 'c', text: 'x' }] }] },
    { id: 'x', title: 'x', startSceneId: 's', scenes: [{ id: 's', kind: 'dialogue', text: 'x', choices: [{ id: 'c', text: 'x', nextSceneId: 'e', effects: [{ kind: 'inc', score: 'money', by: 1 }] }] }, { id: 'e', kind: 'terminal', text: 'e' }] },
    { id: 'x', title: 'x', startSceneId: '', scenes: [{ id: '', kind: 'terminal', text: 'x' }] },
  ];
  for (const raw of rejected) {
    let failed = false;
    try { schema.parseEpisode(raw); } catch { failed = true; }
    if (!failed) throw new Error('invalid schema was accepted');
  }

  const choice = { id: 'trust', text: 'Довериться', nextSceneId: 'end', effects: [{ kind: 'inc', score: 'junhoScore', by: 2 }, { kind: 'setFlag', flag: 'trusted_junho', value: true }] };
  const next = engine.applyChoice(initial, choice);
  if (next.junhoScore !== 2 || next.flags.trusted_junho !== true || initial.junhoScore !== 0) throw new Error('applyChoice failed');
  const conditional = { id: 's', kind: 'dialogue', text: 'x', choices: [choice, { id: 'secret', text: 'secret', nextSceneId: 'end', conditions: [{ kind: 'scoreAtLeast', score: 'truthScore', value: 2 }] }] };
  if (engine.getAvailableChoices(conditional, initial).length !== 1) throw new Error('conditions failed');

  const valid = schema.parseEpisode({ id: 'mini', title: 'Mini', startSceneId: 'start', requiredSceneIds: ['end'], scenes: [{ id: 'start', kind: 'narrative', text: 'start', choices: [{ id: 'go', text: 'go', nextSceneId: 'end' }] }, { id: 'end', kind: 'terminal', text: 'end' }] });
  if (validator.validateEpisode(valid).length !== 0) throw new Error('valid episode rejected');
  const missing = structuredClone(valid); missing.scenes[0].choices[0].nextSceneId = 'missing';
  if (!validator.validateEpisode(missing).some((x) => x.code === 'MISSING_SCENE_REFERENCE')) throw new Error('missing reference not reported');
  const unreachable = structuredClone(valid); unreachable.scenes.push({ id: 'secret', kind: 'terminal', text: 'secret' }); unreachable.requiredSceneIds = ['secret'];
  if (!validator.validateEpisode(unreachable).some((x) => x.code === 'UNREACHABLE_REQUIRED_SCENE')) throw new Error('unreachable required scene not reported');
  const loop = schema.parseEpisode({ id: 'loop', title: 'loop', startSceneId: 'a', scenes: [{ id: 'a', kind: 'narrative', text: 'a', nextSceneId: 'b' }, { id: 'b', kind: 'narrative', text: 'b', nextSceneId: 'a' }] });
  if (!validator.validateEpisode(loop).some((x) => x.code === 'NON_TERMINATING_PATH')) throw new Error('non-terminal route not reported');
  const paths = validator.enumeratePaths(valid, initial);
  if (paths.length !== 1 || !paths[0].terminal || paths[0].sceneIds.join(',') !== 'start,end') throw new Error('path enumeration failed');
  console.log('PASS: reusable story schema + engine + validator contracts');
} finally { rmSync(out, { recursive: true, force: true }); }
