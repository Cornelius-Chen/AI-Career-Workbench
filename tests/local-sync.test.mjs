import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {LocalSync,canonical,seal,open,sharedSnapshot} from '../scripts/local-sync.mjs';
import schema from '../lib/local-sync-schema.json' with {type:'json'};
const exec=promisify(execFile);
const empty=()=>Object.fromEntries(Object.keys(schema).map(table=>[table,{}]));
const credentials={repo:'test',syncKey:'11'.repeat(32),emails:{owner:'owner',brother:'brother'},ownerLogin:'Cornelius-Chen',members:[{login:'Cornelius-Chen',id:'1',email:'owner'},{login:'Anson-F',id:'2',email:'brother'},{login:'Third-Member',id:'3',email:'third'}]};
async function service(state){const server=createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');if(req.method==='GET'){res.end(JSON.stringify(state));return}const chunks=[];for await(const chunk of req)chunks.push(chunk);const {operations}=JSON.parse(Buffer.concat(chunks));const outcomes=operations.map(operation=>{const actual=state[operation.table][operation.key]||null;const ok=canonical(actual)===canonical(operation.expected)||canonical(actual)===canonical(operation.row);if(ok){if(operation.row===null)delete state[operation.table][operation.key];else state[operation.table][operation.key]=operation.row}return {...operation,ok,actual:state[operation.table][operation.key]||null}});res.end(JSON.stringify({outcomes}))});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return {server,origin:`http://127.0.0.1:${server.address().port}`}}
test('three independent workbenches merge Git updates, preserve a conflict, and converge after a choice',async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'career-sync-'));const remote=path.join(folder,'remote.git');await exec('git',['init','--bare','--initial-branch=main',remote]);
 const ownerState=empty();ownerState.team_members={owner:{email:'owner',resume_shared:0},brother:{email:'brother',resume_shared:0}};ownerState.team_profiles={brother:{member_email:'brother',headline:'initial'}};
 const brotherState=empty(),thirdState=empty();const a=await service(ownerState),b=await service(brotherState),c=await service(thirdState);
 try{
  const clients=[];
  for(const [member,origin] of [['Cornelius-Chen',a.origin],['Anson-F',b.origin],['Third-Member',c.origin]]){const root=path.join(folder,member);await mkdir(root);await exec('git',['clone',remote,path.join(root,'sync-repo')]);await exec('git',['config','user.name',member],{cwd:path.join(root,'sync-repo')});await exec('git',['config','user.email',member+'@example.com'],{cwd:path.join(root,'sync-repo')});await writeFile(path.join(root,'sync-state.json'),JSON.stringify({applied:[],conflicts:[],lastUpload:null,lastPull:null}));clients.push(new LocalSync({member,root,origin,token:'test',credentials}))}
  const [owner,brother,third]=clients;await owner.seed();await brother.initializeFromSeed();await third.initializeFromSeed();assert.deepEqual(brotherState.team_profiles,ownerState.team_profiles);
  ownerState.team_messages.note={id:'note',content:'useful evidence'};brotherState.team_profiles.brother.headline='summer intern';await owner.upload();await brother.upload();await owner.pull();await brother.pull();assert.equal(ownerState.team_profiles.brother.headline,'summer intern');assert.equal(brotherState.team_messages.note.content,'useful evidence');
  ownerState.team_profiles.brother.headline='owner edit';brotherState.team_profiles.brother.headline='brother edit';await owner.upload();await brother.upload();await owner.pull();await brother.pull();assert.equal((await owner.state()).conflicts.length,1);assert.equal((await brother.state()).conflicts.length,1);assert.equal(ownerState.team_profiles.brother.headline,'owner edit');assert.equal(brotherState.team_profiles.brother.headline,'brother edit');
  await owner.resolve((await owner.state()).conflicts[0].id,'remote');await brother.pull();assert.equal(ownerState.team_profiles.brother.headline,'brother edit');assert.equal(brotherState.team_profiles.brother.headline,'brother edit');assert.equal((await brother.state()).conflicts.length,0);assert.equal((await owner.state()).conflicts.length,0);
  thirdState.team_messages.third={id:'third',member_email:'third',content:'a third member verified a source'};await third.upload();await owner.pull();await brother.pull();await third.pull();assert.equal(ownerState.team_messages.third.content,thirdState.team_messages.third.content);assert.equal(brotherState.team_messages.third.content,thirdState.team_messages.third.content);assert.equal(thirdState.team_profiles.brother.headline,'brother edit');
  const ciphertext=await readFile(path.join(owner.repo,'seed.enc'));assert.equal(ciphertext.includes(Buffer.from('initial')),false);assert.throws(()=>open(ciphertext,'22'.repeat(32)));
 }finally{a.server.close();b.server.close();c.server.close();await rm(folder,{recursive:true,force:true})}
});
test('private résumé metadata is omitted until its owner enables sharing',()=>{
 const data=empty();data.team_members={owner:{email:'owner',resume_shared:0},brother:{email:'brother',resume_shared:0}};data.files.resume={id:'resume'};data.team_files.other={id:'other',member_email:'brother'};
 const hidden=sharedSnapshot(data,'Cornelius-Chen',credentials.emails);assert.deepEqual(hidden.files,{});assert.deepEqual(hidden.team_files,{});
 data.team_members.owner.resume_shared=1;const shared=sharedSnapshot(data,'Cornelius-Chen',credentials.emails);assert.equal(shared.files.resume.id,'resume');assert.deepEqual(shared.team_files,{});assert.deepEqual(open(seal(shared,credentials.syncKey),credentials.syncKey),shared);
});

test('change history keeps chronological bundle paths using one Git query',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-history-'));
 const repo=path.join(root,'sync-repo');
 try{
  await exec('git',['init','--initial-branch=main',repo]);
  await exec('git',['config','user.name','History Test'],{cwd:repo});
  await exec('git',['config','user.email','history@example.com'],{cwd:repo});
  await mkdir(path.join(repo,'changes','owner'),{recursive:true});
  await writeFile(path.join(repo,'changes','owner','first.enc'),'first');
  await exec('git',['add','.'],{cwd:repo});await exec('git',['commit','-m','First bundle'],{cwd:repo});
  await mkdir(path.join(repo,'changes','member'),{recursive:true});
  await writeFile(path.join(repo,'changes','member','second.enc'),'second');
  await writeFile(path.join(repo,'changes','member','README.md'),'Not a bundle');
  await exec('git',['add','.'],{cwd:repo});await exec('git',['commit','-m','Second bundle'],{cwd:repo});
  await writeFile(path.join(repo,'changes','owner','first.enc'),'updated');
  await exec('git',['add','.'],{cwd:repo});await exec('git',['commit','-m','Existing path updated'],{cwd:repo});
  const sync=new LocalSync({root,credentials});
  const query=t.mock.method(sync,'git');
  assert.deepEqual(await sync.bundles(),['changes/owner/first.enc','changes/member/second.enc','changes/owner/first.enc'].map(file=>path.join(repo,file)));
  assert.equal(query.mock.callCount(),1);
 }finally{await rm(root,{recursive:true,force:true})}
});
