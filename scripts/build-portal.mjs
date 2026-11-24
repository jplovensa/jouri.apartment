import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { ROOM_NAMES, SCOPES, SEED_WORK, STATUSES, PRIORITIES } from '../src/work-data.js';

const mime = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const assets = Object.create(null);
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) { await collect(file); continue; }
    const type = mime[extname(file)];
    if (type) assets[file === 'dist/index.html' ? '/' : '/' + relative('dist', file)] = {
      type, data: (await readFile(file)).toString('base64'),
    };
  }
}
await collect('dist');
if (!assets['/']) throw new Error('Portal entrypoint is missing.');
const plan = JSON.parse(await readFile('src/plan.json', 'utf8'));
const inputs = { ASSETS: assets, PLAN: plan, ROOM_NAMES, SCOPES, SEED_WORK, STATUSES, PRIORITIES };
const declarations = Object.entries(inputs).map(([name, value]) => `const ${name} = ${JSON.stringify(value)};`).join('\n');
await mkdir('dist/server', { recursive: true });
await writeFile('dist/server/index.js', declarations + '\n' + await readFile('worker/index.js', 'utf8'));
