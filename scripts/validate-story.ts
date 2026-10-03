import { readFile } from 'node:fs/promises';
import { parseEpisode } from '../src/story/schema.ts';
import { validateEpisode } from '../src/story/validator.ts';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: npm run validate:story -- <episode.json>');
  process.exit(2);
}

try {
  const raw = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  const episode = parseEpisode(raw);
  const issues = validateEpisode(episode);
  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`${issue.code}: ${issue.message}`);
    }
    process.exit(1);
  }
  console.log(`OK: ${episode.id} — ${episode.scenes.length} scenes`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
