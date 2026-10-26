import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NeutralAssembly } from '../src/index.mjs';

test('compliance: original bytes survive authorized overlay assembly, with independent receipt', async () => {
  const root = await mkdtemp(join(tmpdir(), 'neutral-compliance-'));
  try {
    const vault = new NeutralAssembly({ root, ownerId: 'verified-owner' });
    const first = await vault.importFiles('donor/source', [
      { path: 'src/engine.js', content: 'export const version = 1;' }
    ]);
    const p = await vault.propose({
      manifestId: first.manifestId, path: 'src/engine.js',
      content: 'export const version = 2;', proposedBy: 'builder'
    });
    await assert.rejects(
      vault.assemble({ manifestId: first.manifestId, proposalIds: [p.proposalId], actor: 'builder' }),
      /owner approval/
    );
    assert.equal((await readdir(join(root, 'assemblies'))).length, 0);
    const approved = await vault.assemble({
      manifestId: first.manifestId, proposalIds: [p.proposalId], actor: 'verified-owner'
    });
    const originalSha = first.manifest.files[0].digest;
    assert.equal((await readFile(join(root, 'sources', originalSha))).toString(), 'export const version = 1;');
    assert.equal((await vault.readAssembledFile(approved.assemblyId, 'src/engine.js')).toString(), 'export const version = 2;');
    assert.equal(JSON.parse(await readFile(join(root, 'assemblies', approved.assemblyId))).approvedBy, 'verified-owner');
    assert.equal((await readdir(join(root, 'sources'))).length, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});
