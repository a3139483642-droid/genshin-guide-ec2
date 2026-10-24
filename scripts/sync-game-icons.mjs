import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Run manually to refresh the bundled icons. The website never calls these services.
const root = fileURLToPath(new URL('../', import.meta.url));
const folders = ['characters', 'weapons', 'artifacts'];
const catalog = {};
const downloads = new Map();
const failures = [];

await Promise.all(folders.map(async folder => {
  const url = `https://genshin-db-api.vercel.app/api/v5/${folder}?query=names&matchCategories=true&verboseCategories=true&resultLanguage=ChineseSimplified`;
  const response = await fetch(url, {signal: AbortSignal.timeout(45000)});
  if (!response.ok) throw new Error(`Cannot read ${folder}: ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error(`Unexpected ${folder} response`);
  catalog[folder] = data.map(item => {
    const slot = folder === 'artifacts' ? (item.flower ? 'flower' : 'circlet') : 'icon';
    const filename = item.images?.[`filename_${slot}`];
    if (!filename || !/^UI_[\w]+$/.test(filename)) throw new Error(`Missing icon filename: ${item.name}`);
    const icon = `/game-icons/${folder}/${filename}.png`;
    downloads.set(icon, {icon, filename, original: item.images?.[`mihoyo_${slot}`]});
    return {
      id: item.id,
      name: item.name,
      rarity: item.rarity || Math.max(...item.rarityList),
      ...(folder === 'characters' ? {element: item.elementText} : {}),
      icon,
    };
  });
  await mkdir(path.join(root, 'public', 'game-icons', folder), {recursive: true});
}));

const pending = [...downloads.values()];
let completed = 0;
async function download(item) {
  const destination = path.join(root, 'public', item.icon);
  try {
    const existing = await readFile(destination);
    if (existing.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return;
  } catch {}
  const urls = [`https://enka.network/ui/${item.filename}.png`, item.original].filter(Boolean);
  for (const url of urls) {
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(15000)});
      if (!response.ok) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) continue;
      await writeFile(destination, bytes);
      return;
    } catch {}
  }
  failures.push(item.filename);
}
await Promise.all(Array.from({length: 8}, async () => {
  while (pending.length) {
    await download(pending.pop());
    completed++;
    if (completed % 50 === 0) console.log(`Icons saved: ${completed} / ${downloads.size}`);
  }
}));
if (failures.length) throw new Error(`Icons unavailable: ${failures.join(', ')}`);

await mkdir(path.join(root, 'src', 'data'), {recursive: true});
await writeFile(path.join(root, 'src', 'data', 'game-icons.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(JSON.stringify({saved: downloads.size, entries: Object.fromEntries(folders.map(folder => [folder, catalog[folder].length]))}));
