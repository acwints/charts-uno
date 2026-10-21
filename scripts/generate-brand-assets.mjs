import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(path.join(root, 'packages/marketing/package.json'));
const sharp = require('sharp');
const mark = await readFile(path.join(root, 'packages/web/public/brand-mark.svg'), 'utf8');
const tile = (background, foreground, radius = 0) => mark
  .replaceAll('#2563eb', foreground)
  .replace('fill="none">', `fill="none"><rect width="64" height="64" rx="${radius}" fill="${background}"/>`);
const icon = tile('#2563eb', '#ffffff');
const assets = 'packages/mobile/ios/App/App/Assets.xcassets';
await writeFile(path.join(root, 'packages/web/public/favicon.svg'), tile('#2563eb', '#ffffff', 14));
await writeFile(path.join(root, 'packages/mobile/assets/icon.svg'), icon);

const outputs = [
  ['packages/web/public/icon-192.png', 192, icon],
  ['packages/web/public/icon-512.png', 512, icon],
  ['packages/web/public/apple-touch-icon.png', 180, icon],
  ['packages/mobile/assets/icon.png', 1024, icon],
  [`${assets}/AppIcon.appiconset/AppIcon-512@2x.png`, 1024, icon],
  [`${assets}/AppIcon.appiconset/AppIcon-dark.png`, 1024, tile('#101014', '#ffffff')],
  [`${assets}/AppIcon.appiconset/AppIcon-tinted.png`, 1024, tile('#101014', '#ffffff')],
];
for (const [suffix, size] of [['', 96], ['@2x', 192], ['@3x', 288]]) {
  outputs.push([`${assets}/LaunchMark.imageset/LaunchMark-light${suffix}.png`, size, mark]);
  outputs.push([`${assets}/LaunchMark.imageset/LaunchMark${suffix}.png`, size, mark.replaceAll('#2563eb', '#ffffff')]);
}
for (const [target, size, svg] of outputs) {
  const image = sharp(Buffer.from(svg)).resize(size, size);
  if (!target.includes('LaunchMark.imageset')) image.removeAlpha();
  const png = await image.png().toBuffer();
  await writeFile(path.join(root, target), png);
  const metadata = await sharp(png).metadata();
  if (metadata.width !== size || metadata.height !== size) throw new Error(`Invalid brand asset: ${target}`);
  if (target.includes('AppIcon.appiconset') && metadata.hasAlpha) throw new Error(`App icon must be opaque: ${target}`);
}
console.log(`Generated ${outputs.length} PNGs and two SVGs from brand-mark.svg`);
