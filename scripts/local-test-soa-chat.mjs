import fs from 'node:fs';
for (const file of ['src/features/messages/SoaChatScreen.tsx']) {
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`);
}
const chat=fs.readFileSync('src/features/messages/SoaChatScreen.tsx','utf8');
for (const needle of ['SOA','была в сети очень давно','availableChoices','attachment']) {
  if (!chat.includes(needle)) throw new Error(`SoaChatScreen missing ${needle}`);
}
const story=fs.readFileSync('src/features/story/StoryScreen.tsx','utf8');
if (!story.includes("scene.kind === 'message'")) throw new Error('StoryScreen does not route message scenes');
console.log('PASS: SOA chat structural contract');
