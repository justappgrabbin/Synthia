import fs from 'node:fs';
import crypto from 'node:crypto';

const [dexFile] = process.argv.slice(2);
if (!dexFile) throw new Error('usage: patch-dex.mjs <classes2.dex>');
const buf = fs.readFileSync(dexFile);
if (buf.subarray(0, 4).toString('ascii') !== 'dex\n') throw new Error('not a dex file');

const oldValue = Buffer.from('package.json', 'utf8');
const newValue = Buffer.from('v048-refresh', 'utf8');
if (oldValue.length !== newValue.length) throw new Error('marker replacement must preserve byte length');

const stringCount = buf.readUInt32LE(0x38);
const stringIdsOff = buf.readUInt32LE(0x3c);
let hits = 0;

function readUleb(offset) {
  let value = 0, shift = 0, pos = offset;
  while (true) {
    const byte = buf[pos++];
    value |= (byte & 0x7f) << shift;
    if (!(byte & 0x80)) return { value, pos };
    shift += 7;
    if (shift > 28) throw new Error('invalid uleb128');
  }
}

for (let i = 0; i < stringCount; i++) {
  const dataOff = buf.readUInt32LE(stringIdsOff + i * 4);
  const { value: utf16Length, pos } = readUleb(dataOff);
  let end = pos;
  while (end < buf.length && buf[end] !== 0) end++;
  const value = buf.subarray(pos, end);
  if (value.equals(oldValue)) {
    if (utf16Length !== oldValue.length) throw new Error('unexpected package.json utf16 length');
    newValue.copy(buf, pos);
    hits++;
  }
}
if (hits !== 1) throw new Error(`expected exactly one package.json string in dex, found ${hits}`);

const signature = crypto.createHash('sha1').update(buf.subarray(32)).digest();
signature.copy(buf, 12);
let a = 1, b = 0;
for (let i = 12; i < buf.length; i++) {
  a = (a + buf[i]) % 65521;
  b = (b + a) % 65521;
}
buf.writeUInt32LE((((b << 16) | a) >>> 0), 8);
fs.writeFileSync(dexFile, buf);
console.log('classes2.dex refresh marker patched; DEX signature/checksum rebuilt');
