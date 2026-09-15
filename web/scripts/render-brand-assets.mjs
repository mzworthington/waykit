import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'public/assets');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-brand-'));

const TRUSTED_BIN_DIRS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];
const env = { ...process.env, PATH: TRUSTED_BIN_DIRS.join(':') };

function bin(name) {
  for (const dir of TRUSTED_BIN_DIRS) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join('/usr/bin', name);
}

function svg(name) {
  return path.join(assets, name);
}

function raster(src, dest, width) {
  execFileSync(bin('rsvg-convert'), ['-w', String(width), '-o', dest, src], { env });
}

function icoFromPngs(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + images.length * 16;
  for (const image of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(image.width >= 256 ? 0 : image.width, 0);
    entry.writeUInt8(image.height >= 256 ? 0 : image.height, 1);
    entry.writeUInt32LE(image.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += image.data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

const mark = fs.readFileSync(svg('kit-mark.svg'), 'utf8');
const markTile = path.join(tmp, 'mark-tile.svg');
fs.writeFileSync(
  markTile,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#090a0d"/>
  ${mark.replace(/<\?xml[^>]*>/, '').replace(/<svg[^>]*>/, '').replace('</svg>', '')}
</svg>`
);

const logo1024 = path.join(tmp, 'logo-1024.png');
const logo256 = path.join(tmp, 'logo-256.png');
const fav32 = path.join(tmp, 'fav-32.png');
const fav48 = path.join(tmp, 'fav-48.png');
const apple = path.join(assets, 'apple-touch-icon.png');
const ogPng = path.join(tmp, 'og.png');
const bannerPng = path.join(assets, 'kit_banner.png');

raster(markTile, logo1024, 1024);
raster(markTile, logo256, 256);
raster(svg('kit-mark-filled.svg'), fav32, 32);
raster(svg('kit-mark-filled.svg'), fav48, 48);
raster(markTile, apple, 180);
raster(svg('kit-og.svg'), ogPng, 1200);
raster(svg('kit-banner.svg'), bannerPng, 1280);
raster(svg('kit-lockup.svg'), path.join(tmp, 'lockup.png'), 1024);

fs.copyFileSync(logo1024, path.join(assets, 'kit_logo.png'));
fs.copyFileSync(fav32, path.join(assets, 'favicon-32.png'));
execFileSync(bin('cwebp'), ['-q', '92', logo1024, '-o', path.join(assets, 'kit_logo.webp')], { env });
execFileSync(bin('cwebp'), ['-q', '92', logo256, '-o', path.join(assets, 'kit_logo_256.webp')], { env });
execFileSync(bin('cwebp'), ['-q', '92', bannerPng, '-o', path.join(assets, 'kit_banner.webp')], { env });
execFileSync(bin('sips'), ['-s', 'format', 'jpeg', '-s', 'formatOptions', '86', ogPng, '--out', path.join(assets, 'og.jpg')], { env });
fs.writeFileSync(
  path.join(root, 'public/favicon.ico'),
  icoFromPngs([
    { width: 32, height: 32, data: fs.readFileSync(fav32) },
    { width: 48, height: 48, data: fs.readFileSync(fav48) }
  ])
);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('brand assets rendered');
