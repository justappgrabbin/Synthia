import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverProjectRoots, discoverRuntimeCandidates } from '../src/mount-fabric.mjs';
import { resolveBackend } from '../src/backend-resolver.mjs';
import { AutomataSpine } from '../src/automata-spine.mjs';

test('project root discovery ranks actual app above wrappers and static notes', () => {
  const files=['wrapper/site/index.html','wrapper/site/package.json','wrapper/notes/README.md'];
  assert.equal(discoverProjectRoots(files)[0].path,'wrapper/site');
  assert.deepEqual(discoverRuntimeCandidates(files,'wrapper/site').map(x=>x.name),['browser-html','node-js']);
  assert.ok(discoverRuntimeCandidates(files,'wrapper/site').every(x=>!x.available));
  assert.deepEqual(discoverRuntimeCandidates(['data.bin']),[]);
  assert.throws(()=>discoverProjectRoots(['../escape/index.html']),/unsafe/);
});

test('resolver chooses passed local probes, not a service merely because installed', () => {
  const options={workspaceId:'w',requiredCapabilities:['build'],
    probes:[{lane:'local-node',passed:true,capabilities:['build']},{lane:'supabase',passed:true,capabilities:['build']}]};
  assert.equal(resolveBackend(options).selectedLane,'local-node');
  assert.equal(resolveBackend({...options,shared:true}).selectedLane,'supabase');
  assert.equal(resolveBackend({...options,secretsRequired:['API_KEY']}).selectedLane,'supabase');
  assert.equal(resolveBackend({...options,requiredCapabilities:['python']}).status,'blocked');
  assert.equal(resolveBackend({workspaceId:'w',requiredCapabilities:['build'],probes:[{lane:'local-node',passed:false,capabilities:['build']}]}).selectedLane,null);
});

test('three real adapter results chain through dependencies, restart does not rerun accepted steps',async()=>{
  const root=await mkdtemp(join(tmpdir(),'neutral-spine-'));
  try {
    const count={read:0,transform:0,finish:0};
    const adapters={
      read:{probe:async()=>true,execute:async()=>{count.read++;return {text:'a'};},verify:async x=>x.text==='a'},
      transform:{probe:async()=>true,execute:async({inputs})=>{count.transform++;return {text:inputs.read.text+'b'};},verify:async x=>x.text==='ab'},
      finish:{probe:async()=>true,execute:async({inputs})=>{count.finish++;return {text:inputs.transform.text+'c'};},verify:async x=>x.text==='abc'}
    };
    const engine=new AutomataSpine({root,ownerId:'owner',adapters});
    const job=await engine.create({workspaceId:'w',steps:[{id:'read',capability:'read'},{id:'transform',capability:'transform',dependencies:['read']},{id:'finish',capability:'finish',dependencies:['transform']}]});
    await assert.rejects(engine.run(job.taskId,{actor:'worker'}),/owner authorization/);
    const done=await engine.run(job.taskId,{actor:'owner'});
    assert.equal(done.status,'verified');
    assert.equal(done.results.finish.output.text,'abc');
    assert.equal(done.checkpoints.length,3);
    const restarted=new AutomataSpine({root,ownerId:'owner',adapters});
    assert.equal((await restarted.run(job.taskId,{actor:'owner'})).status,'verified');
    assert.deepEqual(count,{read:1,transform:1,finish:1});
  } finally {await rm(root,{recursive:true,force:true});}
});

test('failed and missing capabilities remain explicit, recovery resumes',async()=>{
  const root=await mkdtemp(join(tmpdir(),'neutral-blocked-'));
  try {
    const spine=new AutomataSpine({root,ownerId:'owner'});
    const task=await spine.create({workspaceId:'w',steps:[{id:'one',capability:'compiler'}]});
    assert.equal((await spine.run(task.taskId,{actor:'owner'})).status,'blocked');
    spine.adapters.compiler={probe:async()=>true,execute:async()=>({compiled:true}),verify:async()=>false};
    const fail=await spine.run(task.taskId,{actor:'owner'});
    assert.equal(fail.status,'failed');
    assert.match(fail.blocker.reason,/acceptance rejected/);
    spine.adapters.compiler.verify=async x=>x.compiled===true;
    assert.equal((await spine.run(task.taskId,{actor:'owner'})).status,'verified');
  } finally {await rm(root,{recursive:true,force:true});}
});

test('dependency cycles are rejected before execution',async()=>{
  const root=await mkdtemp(join(tmpdir(),'neutral-cycles-'));
  try{
    const engine=new AutomataSpine({root,ownerId:'owner'});
    await assert.rejects(engine.create({workspaceId:'w',steps:[{id:'a',capability:'x',dependencies:['b']},{id:'b',capability:'y',dependencies:['a']}]}),/cycle/);
  } finally {await rm(root,{recursive:true,force:true});}
});
