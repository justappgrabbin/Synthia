import fs from 'node:fs';
import crypto from 'node:crypto';

const p = process.argv[2];
if (!p) throw new Error('usage: patch-refresh-dex.mjs <classes2.dex>');
const buf = fs.readFileSync(p);
const from = Buffer.from('v048-refresh', 'utf8');
const to = Buffer.from('v472-refresh', 'utf8');
if (from.length !== to.length) throw new Error('refresh markers must be equal length');
let hits = [];
for (let at = buf.indexOf(from); at !== -1; at = buf.indexOf(from, at + 1)) hits.push(at);
if (hits.length !== 1) throw new Error(`expected exactly one v048-refresh marker in classes2.dex; found ${hits.length}`);
to.copy(buf, hits[0]);
const sig = crypto.createHash('sha1').update(buf.subarray(32)).digest();
sig.copy(buf, 12);
let a = 1, b = 0;
for (const byte of buf.subarray(12)) {
  a = (a + byte) % 65521;
  b = (b + a) % 65521;
}
buf.writeUInt32LE((((b << 16) | a) >>> 0), 8);
fs.writeFileSync(p, buf);
console.log('classes2.dex refresh marker advanced v048-refresh -> v472-refresh; DEX signature/checksum rebuilt');
