#!/usr/bin/env node
/* Optional, OFF-BY-DEFAULT companion tool for dsh-composer-collapse.
 *
 * Windows's DSH desktop shell creates its main BrowserWindow without
 * `transparent: true`, so `html.dshcc-wall` has nothing to see through. This
 * script patches that one call site inside the shipped `app.asar` in place
 * (byte-for-byte, same file size, header offsets untouched) and keeps a backup.
 *
 *   node tools/patch-win32-transparency.mjs --asar "F:/…/resources/app.asar"
 *   node tools/patch-win32-transparency.mjs --asar … --dry-run
 *   node tools/patch-win32-transparency.mjs --asar … --restore
 *
 * WARNING: a DSH update replaces app.asar and silently drops the patch;
 * `--restore` (or copying the .orig-* backup back) returns stock behaviour.
 */
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };

const asarPath = opt('--asar');
if (!asarPath) { console.error('usage: --asar <path to app.asar> [--dry-run] [--restore]'); process.exit(64); }
const dryRun = flag('--dry-run');
const restore = flag('--restore');
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const backupPath = asarPath + '.orig-' + stamp;

if (restore) {
  const candidates = fs.readdirSync(path.dirname(asarPath)).filter((n) => n.startsWith(path.basename(asarPath) + '.orig-')).sort();
  if (!candidates.length) { console.error('no backup next to ' + asarPath); process.exit(1); }
  const from = path.join(path.dirname(asarPath), candidates[candidates.length - 1]);
  fs.copyFileSync(from, asarPath);
  console.log('restored ' + asarPath + ' from ' + from);
  process.exit(0);
}

const REPLACEMENTS = [
  [
    'backgroundColor: chromeFallbackFill(),' + String.fromCharCode(10) + String.fromCharCode(9) + String.fromCharCode(9) + String.fromCharCode(9) + 'titleBarStyle: "hidden",',
    'transparent: true,' + String.fromCharCode(10) + String.fromCharCode(9) + String.fromCharCode(9) + String.fromCharCode(9) + 'backgroundColor: "#00000000",' + String.fromCharCode(10) + String.fromCharCode(9) + String.fromCharCode(9) + String.fromCharCode(9) + 'titleBarStyle: "hidden",',
  ],
  ['color: chromeFallbackFill(),', 'color: "#00000000",'],
  ['window.setBackgroundColor(chromeFallbackFill());', 'window.setBackgroundColor("#00000000");'],
];

const fd = fs.openSync(asarPath, 'r');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
const jsonLen = head.readUInt32LE(12);
const headerBuf = Buffer.alloc(jsonLen);
fs.readSync(fd, headerBuf, 0, jsonLen, 16);
const header = JSON.parse(headerBuf.toString('utf8'));
const base = 8 + head.readUInt32LE(4);
const node = header.files && header.files.lib && header.files.lib.files && header.files.lib.files['main.js'];
if (!node) { console.error('lib/main.js not found in ' + asarPath); process.exit(1); }
const offset = base + Number(node.offset);
const size = node.size;
const buf = Buffer.alloc(size);
fs.readSync(fd, buf, 0, size, offset);
fs.closeSync(fd);

let text = buf.toString('latin1');
if (text.includes('transparent: true')) { console.log('already patched - nothing to do'); process.exit(0); }
const applied = [];
for (const [from, to] of REPLACEMENTS) {
  const hits = text.split(from).length - 1;
  applied.push(hits);
  if (hits > 0) text = text.split(from).join(to);
  if (hits === 0) console.log('warning: pattern not found: ' + from.slice(0, 48));
}
if (text.length > size) { console.error('patch grows the file; refusing (need repack)'); process.exit(2); }
text += ' '.repeat(size - text.length);
const out = Buffer.from(text, 'latin1');
if (out.length !== size) { console.error('byte length drift; refusing'); process.exit(3); }

console.log('hits: ' + applied.join(' / ') + '  bytes kept: ' + size);
if (dryRun) { console.log('dry run - nothing written'); process.exit(0); }
if (!fs.existsSync(backupPath)) fs.copyFileSync(asarPath, backupPath);
const w = fs.openSync(asarPath, 'r+');
fs.writeSync(w, out, 0, out.length, offset);
fs.closeSync(w);
console.log('patched ' + asarPath + ' (backup: ' + backupPath + ')');
console.log('fully quit and relaunch the app for this to take effect.');