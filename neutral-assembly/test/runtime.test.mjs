import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { NeutralAssembly, crc32 } from '../src/index.mjs';

async function withAssembly(fn) {
  const root = await mkdtemp(join(tmpdir(), 'synthia-neutral-'));
  try { return await fn(new NeutralAssembly({ root, ownerId: 'owner' }), root); }
  finally { await rm(root, { recursive: true, force: true }); }
}
function makeZip(entries) {
  let offset = 0, local = [], central = [];
  for (const { name, text, method = 8, corrupt = false } of entries) {
    const nameBuf = Buffer.from(name), body = Buffer.from(text);
    const packed = method === 8 ? deflateRawSync(body) : body;
    const localHeader = Buffer.alloc(30), centralHeader = Buffer.alloc(46);
    const crc = (crc32(body) + (corrupt ? 1 : 0)) >>> 0;
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(packed.length, 18);
    localHeader.writeUInt32LE(body.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(packed.length, 20);
    centralHeader.writeUInt32LE(body.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    local.push(localHeader, nameBuf, packed);
    central.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + packed.length;
  }
  const dir = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, dir, end]);
}
test('real ZIP files are decompressed, hashed and recoverable after restart', () => withAssembly(async (vault, root) => {
  const data = makeZip([{ name: 'src/index.js', text: 'export const answer = 42' }, { name: 'data.txt', text: 'true bytes', method: 0 }]);
  const { manifestId, manifest } = await vault.importZip('project.zip', data);
  assert.equal(manifest.files.length, 2);
  assert.equal((await vault.get('sources', manifest.sourceDigest)).compare(data), 0);
  const restarted = new NeutralAssembly({ root, ownerId: 'owner' });
  const { assemblyId } = await restarted.assemble({ manifestId, actor: 'owner' });
  assert.equal((await restarted.readAssembledFile(assemblyId, 'src/index.js')).toString(), 'export const answer = 42');
  assert.equal((await restarted.readAssembledFile(assemblyId, 'data.txt')).toString(), 'true bytes');
}));
test('overlays produce a new assembly without modifying stored originals', () => withAssembly(async (vault) => {
  const { manifestId, manifest } = await vault.importFiles('source', [{ path: 'hello.js', content: 'const v = 1' }]);
  const originalDigest = manifest.files[0].digest;
  const { proposalId } = await vault.propose({ manifestId, path: 'hello.js', content: 'const v = 2', proposedBy: 'worker' });
  const base = await vault.assemble({ manifestId, actor: 'owner' });
  const edited = await vault.assemble({ manifestId, proposalIds: [proposalId], actor: 'owner' });
  assert.equal((await vault.readAssembledFile(base.assemblyId, 'hello.js')).toString(), 'const v = 1');
  assert.equal((await vault.readAssembledFile(edited.assemblyId, 'hello.js')).toString(), 'const v = 2');
  assert.equal((await vault.get('sources', originalDigest)).toString(), 'const v = 1');
  assert.notEqual(base.assemblyId, edited.assemblyId);
}));
test('same inputs are idempotent and source hashes stable', () => withAssembly(async (vault) => {
  const a = await vault.importFiles('source', [{ path: 'a.txt', content: 'alpha' }]);
  const b = await vault.importFiles('source', [{ path: 'a.txt', content: 'alpha' }]);
  assert.equal(a.manifestId, b.manifestId);
  assert.equal((await vault.assemble({ manifestId: a.manifestId, actor: 'owner' })).assemblyId,
    (await vault.assemble({ manifestId: b.manifestId, actor: 'owner' })).assemblyId);
}));
test('owner approval required before materializing overlays', () => withAssembly(async (vault) => {
  const { manifestId } = await vault.importFiles('source', [{ path: 'a', content: 'a' }]);
  const { proposalId } = await vault.propose({ manifestId, path: 'a', content: 'b', proposedBy: 'agent' });
  await assert.rejects(vault.assemble({ manifestId, proposalIds: [proposalId], actor: 'agent' }), /owner approval/);
}));
test('path traversal and duplicate source names cannot be imported', () => withAssembly(async (vault) => {
  await assert.rejects(vault.importFiles('source', [{ path: '../escape.js', content: '' }]), /unsafe/);
  await assert.rejects(vault.importFiles('source', [{ path: 'a', content: 'a' }, { path: 'a', content: 'b' }]), /duplicate/);
  await assert.rejects(vault.importZip('bad.zip', makeZip([{ name: '../bad.js', text: 'bad' }])), /unsafe/);
}));
test('CRC mismatch, duplicates and truncated ZIP are rejected', () => withAssembly(async (vault) => {
  await assert.rejects(vault.importZip('bad.zip', makeZip([{ name: 'a', text: 'x', corrupt: true }])), /integrity/);
  await assert.rejects(vault.importZip('bad.zip', makeZip([{ name: 'a', text: 'x' }, { name: 'a', text: 'y' }])), /duplicate/);
  await assert.rejects(vault.importZip('bad.zip', Buffer.from('not a zip')), /invalid ZIP/);
}));
test('expanded data and entry-count limits are enforced', () => withAssembly(async (_, root) => {
  const limited = new NeutralAssembly({ root, ownerId: 'owner', maxFiles: 1, maxBytes: 5 });
  await assert.rejects(limited.importZip('too-big.zip', makeZip([{ name: 'file', text: 'excessive text' }])), /ZIP expanded limit/);
  await assert.rejects(limited.importZip('too-many.zip', makeZip([{ name: 'a', text: '1' }, { name: 'b', text: '2' }])), /ZIP limits/);
}));
test('proposal cannot be applied against an unrelated manifest', () => withAssembly(async (vault) => {
  const a = await vault.importFiles('a', [{ path: 'a', content: 'a' }]);
  const b = await vault.importFiles('b', [{ path: 'b', content: 'b' }]);
  const p = await vault.propose({ manifestId: a.manifestId, path: 'a', content: 'new', proposedBy: 'agent' });
  await assert.rejects(vault.assemble({ manifestId: b.manifestId, proposalIds: [p.proposalId], actor: 'owner' }), /source mismatch/);
}));
