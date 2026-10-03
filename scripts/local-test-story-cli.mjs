import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const dir = mkdtempSync(join(tmpdir(), 'lumi-story-cli-'));
try {
  const valid = join(dir, 'valid.json');
  const invalid = join(dir, 'invalid.json');
  writeFileSync(valid, JSON.stringify({ id: 'ep', title: 'Mini', startSceneId: 's1', requiredSceneIds: ['end'], scenes: [{ id: 's1', kind: 'narrative', text: 'x', nextSceneId: 'end' }, { id: 'end', kind: 'terminal', text: 'end' }] }));
  writeFileSync(invalid, JSON.stringify({ id: 'ep', title: 'Mini', startSceneId: 's1', scenes: [{ id: 's1', kind: 'narrative', text: 'x', nextSceneId: 'missing' }] }));

  execFileSync('node', ['--experimental-strip-types', 'scripts/validate-story.ts', valid], { cwd: root, stdio: 'pipe' });
  const bad = spawnSync('node', ['--experimental-strip-types', 'scripts/validate-story.ts', invalid], { cwd: root, encoding: 'utf8' });
  if (bad.status === 0) throw new Error('invalid story CLI exited 0');
  if (!`${bad.stdout}${bad.stderr}`.includes('MISSING_SCENE_REFERENCE')) throw new Error('invalid story CLI did not report missing reference');
  console.log('PASS: story validation CLI contract');
} finally { rmSync(dir, { recursive: true, force: true }); }
