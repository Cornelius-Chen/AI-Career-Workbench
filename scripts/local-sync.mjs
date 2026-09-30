import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {readFile,writeFile,mkdir,readdir,access} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export const canonical=row=>JSON.stringify(row===null?null:Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))));
export const hash=row=>createHash('sha256').update(canonical(row)).digest('hex');
export function seal(value,key){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);const body=Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(value)))),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body])}
export function open(bytes,key){const cipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),bytes.subarray(0,12));cipher.setAuthTag(bytes.subarray(12,28));return JSON.parse(gunzipSync(Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()])).toString())}
export function sharedSnapshot(all,member,email){
 const state=structuredClone(all);
 const sharing=Object.fromEntries(Object.values(state.team_members).map(row=>[row.email,!!row.resume_shared]));
 if(!sharing[email.owner])state.files={};
 state.team_files=Object.fromEntries(Object.entries(state.team_files).filter(([,row])=>sharing[row.member_email]));
 return state;
}
export function differences(base,current,member){
 const changes=[];
 for(const [table,rows] of Object.entries(current)){
  if(member!=='Cornelius-Chen'&&['jobs','applications','events','files'].includes(table))continue;
  for(const key of new Set([...Object.keys(base[table]||{}),...Object.keys(rows)])){
   const before=base[table]?.[key]||null,row=rows[key]||null;
   if(hash(before)!==hash(row))changes.push({table,key,parents:[hash(before)],row});
  }
 }
 return changes;
}
export function planIncoming(state,changes){
 const operations=[],conflicts=[];
 for(const change of changes){
  const current=state[change.table]?.[change.key]||null;
  if(hash(current)===hash(change.row))continue;
  if(change.parents.includes(hash(current)))operations.push({...change,expected:current});
  else conflicts.push({...change,local:current});
 }
 return {operations,conflicts};
}
const exists=async file=>{try{await access(file);return true}catch(error){if(error.code==='ENOENT')return false;throw error}};
const readJSON=async file=>JSON.parse(await readFile(file,'utf8'));
const saveJSON=(file,data)=>writeFile(file,JSON.stringify(data),{mode:0o600});

export class LocalSync{
 constructor(config){this.config=config;this.root=config.root;this.repo=path.join(this.root,'sync-repo');this.credentials=config.credentials;this.baseFile=path.join(this.root,'base.json');this.stateFile=path.join(this.root,'sync-state.json')}
 async git(...args){return (await exec('git',args,{cwd:this.repo,maxBuffer:10*1024*1024})).stdout.trim()}
 async local(method='GET',body,filename){
  const response=await fetch(this.config.origin+'/api/local-sync/data'+(filename?'?file='+encodeURIComponent(filename):''),{method,headers:{Authorization:'Bearer '+this.config.token,...(!filename?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:filename?body:JSON.stringify(body)}:{})});
  if(!response.ok)throw Error('本地工作台未就绪：'+await response.text());
  return filename&&method==='GET'?Buffer.from(await response.arrayBuffer()):response.json();
 }
 async state(){return readJSON(this.stateFile)}
 async apply(operations){const outcomes=[];for(let i=0;i<operations.length;i+=25){const result=await this.local('POST',{operations:operations.slice(i,i+25)});outcomes.push(...result.outcomes)}return {outcomes}}
 async snapshot(){return sharedSnapshot(await this.local(),this.config.member,this.credentials.emails)}
 async bootstrap(){
  await mkdir(this.root,{recursive:true});
  if(!await exists(this.repo))await exec('gh',['repo','clone',this.credentials.repo,this.repo]);
  await this.git('config','user.name',this.config.member);
  await this.git('config','user.email',`${this.credentials.ids[this.config.member]}+${this.config.member}@users.noreply.github.com`);
  if(!await exists(this.stateFile))await saveJSON(this.stateFile,{applied:[],conflicts:[],lastUpload:null,lastPull:null});
 }
 async requireIdentity(){const {stdout}=await exec('gh',['api','user','--jq','.login']);if(stdout.trim()!==this.config.member)throw Error(`请在 GitHub CLI 登录 ${this.config.member}，当前为 ${stdout.trim()}`)}
 async status(){const state=await this.state();return {member:this.config.member,repo:this.credentials.repo,lastUpload:state.lastUpload,lastPull:state.lastPull,conflicts:state.conflicts.map(item=>({id:item.id,table:item.table,key:item.key,local:item.local,remote:item.row,author:item.author})),private:true}}
 async pullRepository(){await this.git('pull','--rebase','origin','main')}
 async commit(message){await this.git('add','.');const pending=await this.git('status','--porcelain');if(pending)await this.git('commit','-m',message);await this.git('push','origin','HEAD:main')}
 fileKeys(snapshot){return [...Object.keys(snapshot.files),...Object.keys(snapshot.team_files).map(id=>'team/'+id)]}
 async storeFiles(snapshot){
  const keys=this.fileKeys(snapshot);await mkdir(path.join(this.repo,'files'),{recursive:true});
  for(const key of keys){const name=createHash('sha256').update(key).digest('hex')+'.enc';const file=path.join(this.repo,'files',name);if(!await exists(file)){const bytes=await this.local('GET',undefined,key);await writeFile(file,seal({key,bytes:bytes.toString('base64')},this.credentials.syncKey),{mode:0o600})}}
 }
 async restoreFiles(snapshot){
  for(const key of this.fileKeys(snapshot)){const name=createHash('sha256').update(key).digest('hex')+'.enc';const file=path.join(this.repo,'files',name);const payload=open(await readFile(file),this.credentials.syncKey);await this.local('POST',Buffer.from(payload.bytes,'base64'),key)}
 }
 async seed(){
  const snapshot=await this.snapshot();await this.storeFiles(snapshot);
  await writeFile(path.join(this.repo,'seed.enc'),seal(snapshot,this.credentials.syncKey),{mode:0o600});
  await writeFile(path.join(this.repo,'README.md'),'# Career Workbench private data\n\nEncrypted local-workbench snapshots and append-only changes. Access is restricted to Cornelius-Chen and Anson-F. No keys or credentials are stored here.\n');
  await writeFile(path.join(this.repo,'.gitattributes'),'*.enc binary\n');
  await this.commit('Initialize encrypted shared career records');
  await saveJSON(this.baseFile,snapshot);const state=await this.state();state.seeded=true;await saveJSON(this.stateFile,state);
 }
 async initializeFromSeed(){
  await this.pullRepository();const snapshot=open(await readFile(path.join(this.repo,'seed.enc')),this.credentials.syncKey);
  const all=await this.local();const changes=Object.entries(snapshot).flatMap(([table,rows])=>Object.entries(rows).map(([key,row])=>({table,key,expected:all[table][key]||null,row})));
  const result=await this.apply(changes);if(result.outcomes.some(item=>!item.ok))throw Error('初次导入出现冲突');
  await this.restoreFiles(snapshot);await saveJSON(this.baseFile,snapshot);const state=await this.state();state.seeded=true;await saveJSON(this.stateFile,state);await this.pull(false);
 }
 async publish(changes,label){
  const id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID();
  const folder=path.join(this.repo,'changes',this.config.member);await mkdir(folder,{recursive:true});
  await writeFile(path.join(folder,id+'.enc'),seal({id,author:this.config.member,created:new Date().toISOString(),changes},this.credentials.syncKey),{mode:0o600});
  await this.commit(label);return id;
 }
 async upload(){
  await this.pullRepository();const current=await this.snapshot();const base=await readJSON(this.baseFile);const changes=differences(base,current,this.config.member);
  await this.storeFiles(current);
  const state=await this.state();
  if(changes.length){const id=await this.publish(changes,'Sync '+this.config.member+' career updates');state.applied.push(id)}
  else await this.commit('Share career attachments');
  await saveJSON(this.baseFile,current);state.lastUpload=new Date().toISOString();await saveJSON(this.stateFile,state);
  return {message:changes.length?`已上传 ${changes.length} 条更新`:'没有新的记录需要上传'};
 }
 async bundles(){
  const commits=(await this.git('log','--reverse','--format=%H','--','changes')).split('\n').filter(Boolean);const files=[];
  for(const commit of commits){const changed=await this.git('diff-tree','--root','--no-commit-id','--name-only','-r',commit,'--','changes');for(const file of changed.split('\n'))if(file.endsWith('.enc'))files.push(path.join(this.repo,file))}
  return files;
 }
 async pull(refresh=true){
  if(refresh)await this.pullRepository();
  const state=await this.state(),base=await readJSON(this.baseFile);let applied=0;
  for(const file of await this.bundles()){
   const bundle=open(await readFile(file),this.credentials.syncKey);if(state.applied.includes(bundle.id))continue;
   const current=await this.snapshot();const plan=planIncoming(current,bundle.changes);
   for(const change of bundle.changes)if(hash(current[change.table]?.[change.key]||null)===hash(change.row)){if(change.row===null)delete base[change.table][change.key];else base[change.table][change.key]=change.row}
   const result=await this.apply(plan.operations);
   for(const outcome of result.outcomes){if(outcome.ok){if(outcome.row===null)delete base[outcome.table][outcome.key];else base[outcome.table][outcome.key]=outcome.row;applied++}else plan.conflicts.push({...outcome,local:outcome.actual})}
   for(const change of bundle.changes)if(change.parents.length>1&&(hash(current[change.table]?.[change.key]||null)===hash(change.row)||result.outcomes.some(outcome=>outcome.ok&&outcome.table===change.table&&outcome.key===change.key)))state.conflicts=state.conflicts.filter(conflict=>conflict.table!==change.table||conflict.key!==change.key);
   for(const conflict of plan.conflicts){state.conflicts=state.conflicts.filter(previous=>previous.table!==conflict.table||previous.key!==conflict.key);state.conflicts.push({...conflict,id:randomUUID(),bundleId:bundle.id,author:bundle.author})}
   state.applied.push(bundle.id);
  }
  await this.restoreFiles(await this.snapshot());await saveJSON(this.baseFile,base);state.lastPull=new Date().toISOString();await saveJSON(this.stateFile,state);
  return {message:`已拉取 ${applied} 条更新${state.conflicts.length?`，${state.conflicts.length} 条冲突等待选择`:''}`};
 }
 async resolve(id,choice){
  await this.pullRepository();const state=await this.state(),base=await readJSON(this.baseFile);const conflict=state.conflicts.find(item=>item.id===id);
  const current=(await this.snapshot())[conflict.table][conflict.key]||null;const row=choice==='remote'?conflict.row:current;
  const change={table:conflict.table,key:conflict.key,parents:[hash(current),hash(conflict.row)],row};
  const result=await this.apply([{...change,expected:current}]);if(!result.outcomes[0].ok)throw Error('记录刚刚发生了变化，请重新选择');
  const bundleId=await this.publish([change],'Resolve shared career record conflict');state.applied.push(bundleId);state.conflicts=state.conflicts.filter(item=>item.id!==id);
  if(row===null)delete base[change.table][change.key];else base[change.table][change.key]=row;
  await saveJSON(this.baseFile,base);await saveJSON(this.stateFile,state);return {message:'选择已保存并上传，另一方拉取后会采用这个版本'};
 }
}
