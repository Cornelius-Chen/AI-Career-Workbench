import {readFile,writeFile,mkdir,access,readdir} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {LocalSync} from './local-sync.mjs';
import {normalizeCredentials,soloCredentials,memberEnvironment} from './local-config.mjs';

const project=fileURLToPath(new URL('../',import.meta.url));process.chdir(project);
const root=path.resolve(process.env.CAREER_LOCAL_DIRECTORY||path.join(project,'.local'));
const exec=promisify(execFile);
const readJSON=async file=>JSON.parse(await readFile(file,'utf8'));
const saveJSON=(file,data)=>writeFile(file,JSON.stringify(data,null,2),{mode:0o600});
const exists=async file=>{try{await access(file);return true}catch(error){if(error.code==='ENOENT')return false;throw error}};
const [command,...args]=process.argv.slice(2);
const option=(name,fallback)=>{const index=args.indexOf('--'+name);return index<0?fallback:args[index+1]};
const node=process.execPath;
const wrangler=path.join(project,'node_modules/wrangler/bin/wrangler.js');
const wranglerRun=async(...args)=>{await exec(node,[wrangler,...args],{cwd:project,maxBuffer:12*1024*1024});console.log('本地数据库已准备。')};
const runtime=async()=>{const config=await readJSON(path.join(root,'runtime.json'));return {...config,root,credentials:normalizeCredentials(await readJSON(path.join(root,'credentials.json')))}};

if(command==='setup'){
 const source=option('credentials');
 const credentials=source?normalizeCredentials(await readJSON(path.resolve(source))):await exists(path.join(root,'credentials.json'))?normalizeCredentials(await readJSON(path.join(root,'credentials.json'))):soloCredentials(option('name','我'));
 const installed=await exists(path.join(root,'runtime.json'))?await readJSON(path.join(root,'runtime.json')):null;
 const member=option('member',installed?.member||credentials.members[0].login);
 if(!credentials.members.some(person=>person.login===member))throw Error('安装文件中没有这个成员，请使用邀请中的 GitHub 用户名');
 await mkdir(root,{recursive:true});await saveJSON(path.join(root,'credentials.json'),credentials);
 const appPort=Number(option('port',String(installed?.appPort||4317))),syncPort=appPort+1,token=randomBytes(32).toString('hex');
 console.log('正在构建本地工作台…');const built=spawn(process.platform==='win32'?'npm.cmd':'npm',['run','build:standalone'],{stdio:'inherit'});await new Promise((resolve,reject)=>built.on('exit',code=>code===0?resolve():reject(Error('本地构建失败'))));
 const config=await readJSON('dist/server/wrangler.json');config.main=path.join(project,'dist/server/index.js');config.assets.directory=path.join(project,'dist/client');config.configPath=path.join(root,'wrangler.json');config.userConfigPath=config.configPath;
 config.d1_databases[0].migrations_dir=path.join(project,'drizzle');
 config.vars=memberEnvironment(credentials,member,syncPort);
 await writeFile(path.join(root,'.dev.vars'),`TEAM_FILE_KEY=${credentials.fileKey}\nCAREER_LOCAL_SYNC_TOKEN=${token}\n`,{mode:0o600});
 await saveJSON(path.join(root,'wrangler.json'),config);
 await saveJSON(path.join(root,'runtime.json'),{member,appPort,syncPort,token,origin:`http://127.0.0.1:${appPort}`});
 if(!await exists(path.join(root,'database-initialized'))){
  const importFile=option('import');
  if(importFile){await wranglerRun('d1','execute','ai-career-workbench','--local','--config',path.join(root,'wrangler.json'),'--persist-to',path.join(root,'state'),'--file',path.resolve(importFile));await writeFile(path.join(root,'imported-cloud'),'production D1 export')}
  else await wranglerRun('d1','migrations','apply','ai-career-workbench','--local','--config',path.join(root,'wrangler.json'),'--persist-to',path.join(root,'state'));
  await writeFile(path.join(root,'database-initialized'),'initialized');
 }
 const person=credentials.members.find(person=>person.login===member);const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
 await wranglerRun('d1','execute','ai-career-workbench','--local','--config',path.join(root,'wrangler.json'),'--persist-to',path.join(root,'state'),'--command',`INSERT OR IGNORE INTO team_members(email,name,role,created) VALUES(${quote(person.email)},${quote(person.name)},${quote(person.email===credentials.emails.owner?'owner':'member')},${quote(new Date().toISOString())}); INSERT OR IGNORE INTO team_profiles(member_email,updated) VALUES(${quote(person.email)},${quote(new Date().toISOString())});`);
 if(credentials.repo){const sync=new LocalSync(await runtime());await sync.requireIdentity();await sync.bootstrap();}
 console.log('安装完成。运行 npm run local:start 打开本地平台。');
}else if(command==='start'){
 const config=await runtime(),sync=new LocalSync(config);let busy=false;
 let running=false;
 try{const response=await fetch(config.origin+'/api/local-sync');if(response.ok){const status=await response.json();running=status.member===config.member}}catch(error){if(error.cause?.code!=='ECONNREFUSED')throw error}
 if(running){console.log(`工作台已经运行：${config.origin}/team`);process.exit(0)}
 const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(req.headers.authorization!=='Bearer '+config.token){res.statusCode=403;res.end(JSON.stringify({error:'FORBIDDEN'}));return}
  if(req.method==='GET'){res.end(JSON.stringify({...await sync.status(),busy}));return}
  if(busy){res.statusCode=409;res.end(JSON.stringify({error:'同步正在进行，请稍后'}));return}
  busy=true;
  try{
   const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());
   if(!config.credentials.repo)throw Error('尚未开启协作同步，请在使用引导中将设置指令交给 Agent');
   const workspace=await (await fetch(config.origin+'/api/team?view=preferences')).json();if(workspace.mode==='solo')throw Error('单人模式不上传或拉取共享数据，请先在空间设置中开启协作');
   await sync.requireIdentity();let result;
   if(body.action==='upload')result=await sync.upload();
   else if(body.action==='pull')result=await sync.pull();
   else if(body.action==='sync'){const upload=await sync.upload(),pull=await sync.pull();result={message:upload.message+'；'+pull.message}}
   else if(body.action==='resolve')result=await sync.resolve(body.id,body.choice);
   else throw Error('未知同步操作');
   res.end(JSON.stringify({...result,status:await sync.status()}));
  }catch(error){res.statusCode=400;res.end(JSON.stringify({error:error.message}))}finally{busy=false}
 });
 server.listen(config.syncPort,'127.0.0.1');
 const app=spawn(node,[wrangler,'dev','--local','--config',path.join(root,'wrangler.json'),'--persist-to',path.join(root,'state'),'--port',String(config.appPort),'--ip','127.0.0.1','--inspector-port','0'],{stdio:'inherit'});
 const stop=()=>{app.kill();server.close()};process.on('SIGINT',stop);process.on('SIGTERM',stop);app.on('exit',()=>server.close());
 if(config.credentials.repo&&!await exists(path.join(root,'imported-cloud'))&&!(await sync.state()).seeded){
  console.log('正在导入私有仓库中的共享数据…');
  let ready=false;for(let i=0;i<100;i++){try{const response=await fetch(config.origin+'/team');if(response.ok){ready=true;break}}catch(error){if(error.cause?.code!=='ECONNREFUSED')throw error}await new Promise(resolve=>setTimeout(resolve,200))}
  if(!ready)throw Error('本地服务没有启动');
  await sync.requireIdentity();await sync.initializeFromSeed();
 }
 console.log(`\n${config.member} 的本地工作台：${config.origin}/team\n关闭本终端会停止工作台。\n`);
}else if(command==='share'||command==='invite'){
 const config=await runtime();await manageSharing(command,config);
}else{
 const sync=new LocalSync(await runtime());
 if(command==='seed'){await sync.requireIdentity();await sync.seed();console.log('加密共享数据已初始化到私有仓库。')}
 else if(command==='import-files'){const folder=path.resolve(option('directory'));for(const file of await readdir(folder))await sync.local('POST',await readFile(path.join(folder,file)),file);console.log('原有附件已迁到本机。')}
 else if(command==='sync'){if(!sync.credentials.repo)throw Error('单人工作台尚未配置共享仓库');const preferences=await (await fetch(sync.config.origin+'/api/team?view=preferences')).json();if(preferences.mode==='solo')throw Error('请先在空间设置中开启协作');await sync.requireIdentity();console.log(await sync.upload());console.log(await sync.pull())}
 else if(command==='status')console.log(await sync.status());
 else throw Error('支持 setup、start、seed、import-files、sync、status');
}

async function configure(config){
 const file=path.join(root,'wrangler.json'),worker=await readJSON(file);
 worker.vars=memberEnvironment(config.credentials,config.member,config.syncPort);
 await saveJSON(file,worker);await saveJSON(path.join(root,'credentials.json'),config.credentials);
 const {credentials,...settings}=config;delete settings.root;await saveJSON(path.join(root,'runtime.json'),settings);
}
async function registerMember(config,person){
 const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
 await wranglerRun('d1','execute','ai-career-workbench','--local','--config',path.join(root,'wrangler.json'),'--persist-to',path.join(root,'state'),'--command',`INSERT INTO team_members(email,name,role,created) VALUES(${quote(person.email)},${quote(person.name)},${quote(person.email===config.credentials.emails.owner?'owner':'member')},${quote(new Date().toISOString())}) ON CONFLICT(email) DO UPDATE SET name=excluded.name; INSERT OR IGNORE INTO team_profiles(member_email,updated) VALUES(${quote(person.email)},${quote(new Date().toISOString())});`);
}
async function manageSharing(command,config){
 const account=JSON.parse((await exec('gh',['api','user'])).stdout),credentials=config.credentials;
 if(command==='share'){
  if(credentials.repo)throw Error('已配置共享仓库，使用 local:invite 添加成员');
  const person=credentials.members.find(member=>member.login===config.member);
  person.login=account.login;person.id=String(account.id);config.member=account.login;credentials.ownerLogin=account.login;
  credentials.repo=option('repo',account.login+'/AI-Career-Workbench-Data');credentials.syncKey=randomBytes(32).toString('hex');credentials.mode='collaboration';
  await exec('gh',['repo','create',credentials.repo,'--private','--description','Encrypted career workbench sync']);
  await registerMember(config,person);await configure(config);
  const sync=new LocalSync(config);await sync.requireIdentity();await sync.bootstrap();await sync.seed();
  const response=await fetch(config.origin+'/api/team',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'workspace.mode',mode:'collaboration'})});if(!response.ok)throw Error(await response.text());
  console.log('私有加密同步仓库已创建。请关闭并重新启动工作台，再运行 local:invite 邀请伙伴。');
 }else{
  if(!credentials.repo)throw Error('先用 local:share 创建协作空间');
  const login=option('login');if(!login)throw Error('用 --login 指定伙伴的 GitHub 用户名');
  const user=JSON.parse((await exec('gh',['api','users/'+login])).stdout);
  const person={login:user.login,name:option('name',user.login),id:String(user.id),email:option('email',`${user.id}+${user.login}@users.noreply.github.com`).toLowerCase()};
  await exec('gh',['api','--method','PUT','repos/'+credentials.repo+'/collaborators/'+user.login,'-f','permission=push']);
  const previous=credentials.members.find(member=>member.login===person.login);if(previous)Object.assign(previous,person);else credentials.members.push(person);
  await registerMember(config,person);await configure(config);
  const sync=new LocalSync(config);await sync.requireIdentity();await sync.upload();
  const folder=path.join(root,'invitations',person.login);await mkdir(folder,{recursive:true});
  await saveJSON(path.join(folder,'career-local-credentials.json'),credentials);
  await writeFile(path.join(folder,'START.md'),`# 安装求职工作台\n\n请将本目录私下交给 ${person.login}。接受 https://github.com/${credentials.repo}/invitations 后，按代码库 docs/GETTING-STARTED.md 安装。运行 npm run local:setup -- --member ${person.login} --credentials /完整路径/career-local-credentials.json 。密钥不发到公开聊天，不提交到仓库。`,{mode:0o600});
  console.log(`邀请已发出。私下发送安装目录：${folder}。伙伴接受并安装后同步。`);
 }
}
