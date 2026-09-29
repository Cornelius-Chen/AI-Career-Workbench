import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import seedJobs from '@/data/jobs.json';
import reviewedResume from '@/data/manually-reviewed-resume.json';
import {canonical,defaultProfile,defaultRules,rank,type Fact} from './domain';
export function db(){if(!env.DB)throw Error('数据服务暂时不可用，请稍后重试');return env.DB}
export function bucket(){if(!env.BUCKET)throw Error('文件服务暂时不可用，请稍后重试');return env.BUCKET}
export async function owner(allowWorker=false){
 if(allowWorker&&env.CAREER_WORKER_TOKEN_SHA256){const h=await headers();const token=h.get('x-career-worker-token');if(token){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));const actual=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');if(actual.length===env.CAREER_WORKER_TOKEN_SHA256.length){let mismatch=0;for(let i=0;i<actual.length;i++)mismatch|=actual.charCodeAt(i)^env.CAREER_WORKER_TOKEN_SHA256.charCodeAt(i);if(!mismatch)return{kind:'worker',userId:'owner-authorized-worker',email:env.CAREER_OWNER_EMAIL}}}}
 const u=await getChatGPTUser();if(!u)throw Error('UNAUTHORIZED');const dev=import.meta.env.DEV&&u.userId==='local_seedy';if(!dev&&u.email.toLowerCase()!==env.CAREER_OWNER_EMAIL.toLowerCase())throw Error('FORBIDDEN');return {...u,kind:'human'};
}

export async function getSetting(key:string,fallback:any=null){const r=await db().prepare('SELECT value FROM settings WHERE id=?').bind(key).first<any>();return r?JSON.parse(r.value):fallback}
export async function setSetting(key:string,value:any){await db().prepare('INSERT INTO settings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(value)).run()}
export async function list(table:'jobs'|'facts'|'resumes'|'events'|'applications'|'tasks'|'files'){const sql=table==='jobs'?"SELECT id,canonical,json_remove(data,'$.description') AS data,updated FROM jobs":table==='facts'?"SELECT * FROM facts WHERE COALESCE(json_extract(data,'$.archived'),0)=0":"SELECT * FROM "+table;const r=await db().prepare(sql).all<any>();return r.results.map((x:any)=>(({data,...row}:any)=>({...row,...JSON.parse(data)}))(x))}
export async function init(){if(await getSetting('seeded'))return;const now=new Date().toISOString();await db().batch([db().prepare('INSERT OR IGNORE INTO settings(id,value) VALUES(?,?)').bind('profile',JSON.stringify(defaultProfile)),db().prepare('INSERT OR IGNORE INTO settings(id,value) VALUES(?,?)').bind('rules',JSON.stringify(defaultRules))]);
 for(let i=0;i<seedJobs.length;i+=30)await db().batch(seedJobs.slice(i,i+30).map((j:any)=>db().prepare('INSERT OR IGNORE INTO jobs(id,canonical,data,updated) VALUES(?,?,?,?)').bind(j.id,canonical(j.url),JSON.stringify({...j,score:rank(j).total}),now)));
 const seeds=(reviewedResume as Fact[]).map(f=>({...f,updated:now}));
 for(let i=0;i<seeds.length;i+=30)await db().batch(seeds.slice(i,i+30).map(f=>db().prepare('INSERT OR IGNORE INTO facts(id,data) VALUES(?,?)').bind(f.id,JSON.stringify(f))));await setSetting('seeded',now);
}
export async function saveJob(j:any){const key=canonical(j.url);const existing=await db().prepare('SELECT id FROM jobs WHERE canonical=? OR id=? ORDER BY CASE WHEN canonical=? THEN 0 ELSE 1 END LIMIT 1').bind(key,j.id,key).first<any>();if(existing)j.id=existing.id;j.score=rank(j).total;if(existing)await db().prepare('UPDATE jobs SET canonical=?,data=?,updated=? WHERE id=?').bind(key,JSON.stringify(j),new Date().toISOString(),j.id).run();else await db().prepare('INSERT INTO jobs(id,canonical,data,updated) VALUES(?,?,?,?)').bind(j.id,key,JSON.stringify(j),new Date().toISOString()).run();}
export async function patchSetting(key:string,patch:any){await db().prepare("UPDATE settings SET value=json_patch(value,?) WHERE id=?").bind(JSON.stringify(patch),key).run()}

export async function task(kind:string,data:any){const id=crypto.randomUUID();await db().prepare('INSERT INTO tasks(id,kind,status,created,data) VALUES(?,?,?,?,?)').bind(id,kind,'pending',new Date().toISOString(),JSON.stringify(data)).run();return id}
