import test from 'node:test';
import assert from 'node:assert/strict';
import {isDiscoveryTitle,selectDiscoveryBatch,readBoardJson,greenhouseDiscoveryJobs,knownDiscoveryKeys} from '../lib/discovery.ts';
import {structuredBoardInfo} from '../lib/official-sources.ts';
import {canonical} from '../lib/domain.ts';
test('discovery requires real role keywords, not AI inside unrelated words',()=>{
 for(const s of ['Retail Associate','Capital Markets Analyst','Maintenance Technician','Senior AI Engineer','Software Engineering Intern'])assert.equal(isDiscoveryTitle(s),false,s);
 for(const s of ['Forward Deployed Engineer','AI Engineer','Software Engineer, Internal Tools','Machine Learning Engineer','Data Scientist','Product Engineer'])assert.equal(isDiscoveryTitle(s),true,s);
});
test('large source resumes safely after partial insertion and ignores duplicate URLs',()=>{
 const jobs=Array.from({length:71},(_,i)=>({title:'AI Engineer',jobUrl:'https://example.com/'+i}));jobs.push(jobs[0]);
 const known=new Set();let calls=0;
 while(true){const {selected,pending}=selectDiscoveryBatch(jobs,known,x=>x);assert.ok(selected.length<=25);for(const j of selected)known.add(j.jobUrl);calls++;if(!pending)break;}
 assert.equal(calls,3);assert.equal(known.size,71);
 assert.deepEqual(selectDiscoveryBatch(jobs,known,x=>x),{selected:[],pending:false});
});
test('actual byte limit rejects an oversized board even without Content-Length',async()=>{
 let canceled=false;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(40));},cancel(){canceled=true;}});
 await assert.rejects(readBoardJson(new Response(stream),20),/列表过大/);assert.ok(canceled);
 assert.deepEqual(await readBoardJson(new Response('{"jobs":[]}'),100),{jobs:[]});
});
test('employer aliases resolve to the existing Greenhouse requisition without duplicate discovery',()=>{
 for(const [board,id,url] of [
  ['stripe',8128744,'https://stripe.com/jobs/search?gh_jid=8128744'],
  ['databricks',7586263002,'https://databricks.com/company/careers/open-positions/job?gh_jid=7586263002'],
  ['roblox',8072244,'https://careers.roblox.com/jobs/8072244?gh_jid=8072244'],
  ['ixllearning',8765715002,'https://www.ixl.com/company/jobs?gh_jid=8765715002'],
 ]){
  const expected=`https://job-boards.greenhouse.io/${board}/jobs/${id}`;
  const jobs=greenhouseDiscoveryJobs(board,[{id,title:'AI Engineer',absolute_url:url}]);
  assert.equal(jobs[0].absolute_url,expected);
  assert.deepEqual(selectDiscoveryBatch(jobs,new Set([expected]),x=>x),{selected:[],pending:false});
  const first=selectDiscoveryBatch(jobs,new Set(),x=>x);
  assert.equal(first.selected.length,1);
  assert.deepEqual(selectDiscoveryBatch(jobs,new Set(first.selected.map(j=>j.absolute_url)),x=>x),{selected:[],pending:false});
 }
});
test('Greenhouse normalization keeps requests on the ATS and rejects malformed identities',()=>{
 const [job]=greenhouseDiscoveryJobs('acme',[{id:'123',jobUrl:'https://unregistered.test/a',absolute_url:'http://localhost/private'}]);
 assert.equal(job.jobUrl,undefined);
 assert.equal(job.absolute_url,'https://job-boards.greenhouse.io/acme/jobs/123');
 for(const board of ['../private','acme?next=x',''])assert.throws(()=>greenhouseDiscoveryJobs(board,[{id:123}]),/来源名称/);
 for(const id of [undefined,0,-1,1.5,Number.MAX_SAFE_INTEGER+1,'123/other',''])assert.throws(()=>greenhouseDiscoveryJobs('acme',[{id}]),/岗位编号/);
});
test('legacy query parameters and employer embeds are deduplicated before importing normalized jobs',()=>{
 const known=knownDiscoveryKeys([
  'https://boards.greenhouse.io/andurilindustries/jobs/5219383007?gh_jid=5219383007',
  'https://www.hudsonrivertrading.com/careers/job/?gh_jid=8052050',
  'https://job-boards.greenhouse.io/embed/job_app?for=roblox&token=8072244',
 ],canonical,structuredBoardInfo);
 for(const [board,id] of [['andurilindustries',5219383007],['wehrtyou',8052050],['roblox',8072244]]){
  const jobs=greenhouseDiscoveryJobs(board,[{id,title:'Software Engineer'}]);
  assert.deepEqual(selectDiscoveryBatch(jobs,known,canonical),{selected:[],pending:false});
 }
 const newRole=greenhouseDiscoveryJobs('andurilindustries',[{id:5219383008,title:'Software Engineer'}]);
 assert.equal(selectDiscoveryBatch(newRole,known,canonical).selected.length,1);
});
