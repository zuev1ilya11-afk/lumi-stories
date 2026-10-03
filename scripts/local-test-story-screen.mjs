import fs from 'node:fs';
const required = [
  'src/features/story/StoryScreen.tsx',
  'src/features/story/DialogueBox.tsx',
  'src/features/story/ChoiceList.tsx',
  'src/features/shell/StartScreen.tsx',
  'src/features/shell/SeasonScreen.tsx',
];
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`);
}
const story = fs.readFileSync('src/features/story/StoryScreen.tsx', 'utf8');
for (const needle of ['getAvailableChoices', 'choicePending', 'data-testid="story-stage"', 'onAdvance']) {
  if (!story.includes(needle)) throw new Error(`StoryScreen missing ${needle}`);
}
const choices = fs.readFileSync('src/features/story/ChoiceList.tsx', 'utf8');
if (!choices.includes('disabled={disabled}')) throw new Error('ChoiceList must disable buttons while pending');
console.log('PASS: StoryScreen structural behavior contract');
