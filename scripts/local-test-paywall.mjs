import fs from 'node:fs';
if (!fs.existsSync('src/features/paywall/PrototypePaywall.tsx')) throw new Error('missing PrototypePaywall');
const src=fs.readFileSync('src/features/paywall/PrototypePaywall.tsx','utf8');
for (const needle of ['История только начинается','Эпизоды 2–5','249 ₽','ориентир будущей цены','Покупка появится в полной версии','purchase_clicked']) {
  if (!src.includes(needle)) throw new Error(`paywall missing ${needle}`);
}
if (/openInvoice|invoice|successful_payment/i.test(src)) throw new Error('Prototype paywall must not invoke real payment');
console.log('PASS: prototype paywall source contract');
