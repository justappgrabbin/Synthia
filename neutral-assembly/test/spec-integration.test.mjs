import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NeutralAssembly } from '../src/index.mjs';
import { MountFabric } from '../src/mount-fabric.mjs';
import { AutomataSpine } from '../src/automata-spine.mjs';
import { resolveBackend } from '../src/backend-resolver.mjs';

test('real content store -> immutable mount -> local task execution -> approved overlay -> restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'synthia-spec-integration-'));
  try {
    const vault = new NeutralAssembly({ root, ownerId: 'owner' });
    const mountFabric = new MountFabric({ vault });
    const mount = await mountFabric.mount({
      name: 'static-demo', source: { kind: 'upload', ref: 'local-file' },
      entries: [{path:'site/index.html',content:Buffer.from('<h1>Starting</h1>')}, {path:'site/README.md',content:Buffer.from('example')}]
    });
    assert.equal(mount.selectedRoot, 'site');
    assert.equal(mount.status, 'mounted');
    const decision = resolveBackend({workspaceId: mount.mountId, requiredCapabilities: ['static-transform'],
      probes:[{lane:'none',passed:true,capabilities:['static-transform']}] });
    assert.equal(decision.selectedLane,'none');
    const spine = new AutomataSpine({root,ownerId:'owner',adapters: {
      read:{probe:async()=>true,execute:async()=>({html:(await mountFabric.readSource(mount.mountId,'site/index.html')).toString()}),verify:async x=>x.html.includes('<h1>')},
      transform:{probe:async()=>true,execute:async({inputs})=>({html:inputs.read.html.replace('Starting','Assembled')}),verify:async x=>x.html.includes('Assembled')}
    }});
    const task = await spine.create({workspaceId:mount.mountId,steps:[{id:'read',capability:'read'},{id:'transform',capability:'transform',dependencies:['read']}]});
    const result = await spine.run(task.taskId,{actor:'owner'});
    assert.equal(result.status, 'verified');
    const proposed = await mountFabric.propose(mount.mountId,'site/index.html',result.results.transform.output.html,'builder');
    await assert.rejects(mountFabric.accept(mount.mountId,[proposed.proposalId],'builder'),/owner approval/);
    const accepted = await mountFabric.accept(mount.mountId,[proposed.proposalId],'owner');
    const restarted = new MountFabric({vault:new NeutralAssembly({root,ownerId:'owner'})});
    assert.equal((await restarted.readSource(mount.mountId,'site/index.html')).toString(),'<h1>Starting</h1>');
    assert.equal((await restarted.readOverlayAssembly(accepted.assemblyId,'site/index.html')).toString(),'<h1>Assembled</h1>');
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('GitHub references cannot be treated as mutable branch-name snapshots', async () => {
  const root = await mkdtemp(join(tmpdir(), 'synthia-git-mount-'));
  try {
    const fabric = new MountFabric({vault:new NeutralAssembly({root,ownerId:'owner'})});
    await assert.rejects(fabric.mount({name:'repo',source:{kind:'github',ref:'owner/repo@main'},sourceVersion:'main',entries:[{path:'index.html',content:'x'}]}),/immutable commit SHA/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
