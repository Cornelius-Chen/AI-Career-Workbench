import {z} from 'zod';
import {db} from '@/lib/store';
import {OWNER_EMAIL,BROTHER_EMAIL,teamError,teamUser} from '@/lib/team';

export const dynamic='force-dynamic';
const reply=(value:any)=>Response.json(value,{headers:{'Cache-Control':'private, no-store'}});
const statuses=['queued','submitted','assessment','interview','offer','rejected','withdrawn'] as const;
const now=()=>new Date().toISOString();

export async function GET(){
 try{
  const me=await teamUser();
  const [members,recommendations,teamApps,teamEvents,ownerApps,ownerEvents,jobs,teamFiles,ownerFiles,messages,agentTasks]=await Promise.all([
   db().prepare('SELECT email,name,role,resume_shared FROM team_members ORDER BY role DESC,created').all<any>(),
   db().prepare('SELECT * FROM team_recommendations ORDER BY created DESC').all<any>(),
   db().prepare('SELECT a.*,r.company,r.title,r.url,r.location,r.lane FROM team_applications a JOIN team_recommendations r ON r.id=a.recommendation_id ORDER BY a.updated DESC').all<any>(),
   db().prepare('SELECT * FROM team_application_events ORDER BY created DESC').all<any>(),
   db().prepare('SELECT a.id,a.job_id,a.status,a.updated,a.data,j.data AS job_data FROM applications a JOIN jobs j ON j.id=a.job_id ORDER BY a.updated DESC').all<any>(),
   db().prepare('SELECT application_id,occurred,data FROM events WHERE application_id IS NOT NULL ORDER BY occurred DESC').all<any>(),
   db().prepare("SELECT id,data FROM jobs WHERE COALESCE(json_extract(data,'$.hidden'),0)=0 ORDER BY CAST(json_extract(data,'$.score') AS REAL) DESC LIMIT 30").all<any>(),
   db().prepare('SELECT * FROM team_files ORDER BY created DESC').all<any>(),
   db().prepare('SELECT id,name,type,created,data FROM files ORDER BY created DESC').all<any>(),
   db().prepare('SELECT * FROM team_messages ORDER BY created DESC LIMIT 100').all<any>(),
   db().prepare('SELECT * FROM team_agent_tasks ORDER BY updated DESC LIMIT 100').all<any>()
  ]);
  const users=members.results.map(m=>({...m,resumeShared:!!m.resume_shared}));
  const shared=(email:string)=>email===me.email||users.some(u=>u.email===email&&u.resumeShared);
  const applications=[
   ...ownerApps.results.map(a=>{const j=JSON.parse(a.job_data),data=JSON.parse(a.data);return {id:'legacy:'+a.id,memberEmail:OWNER_EMAIL,company:j.company,title:j.title,url:j.url,location:j.location||'',lane:j.lane||'',status:a.status,updated:a.updated,notes:data.notes||'',reference:data.reference||'',deadline:data.deadline||null,lastEvidence:data.lastEvidence||'',lastSource:data.lastSource||'',legacy:true,events:ownerEvents.results.filter(e=>e.application_id===a.id).map(e=>({id:e.occurred,created:e.occurred,...JSON.parse(e.data)}))}}),
   ...teamApps.results.map(a=>({id:a.id,memberEmail:a.member_email,company:a.company,title:a.title,url:a.url,location:a.location||'',lane:a.lane||'',status:a.status,updated:a.updated,notes:a.notes,legacy:false,events:teamEvents.results.filter(e=>e.application_id===a.id).map(e=>({id:e.id,created:e.created,stage:e.status,evidence:e.details}))}))
  ].sort((a,b)=>b.updated.localeCompare(a.updated));
  const files=[
   ...teamFiles.results.filter(f=>shared(f.member_email)).map(f=>({id:f.id,memberEmail:f.member_email,name:f.name,type:f.type,size:f.size,created:f.created,url:'/api/team/files/'+f.id})),
   ...ownerFiles.results.filter(()=>shared(OWNER_EMAIL)).map(f=>({id:f.id,memberEmail:OWNER_EMAIL,name:f.name,type:f.type,size:JSON.parse(f.data).size||null,created:f.created,url:'/api/team/files/'+f.id}))
  ];
  return reply({me:{email:me.email,name:me.name,role:me.role,resumeShared:!!me.resume_shared},members:users,recommendations:recommendations.results.map(r=>({...r,coapply:!!r.coapply})),applications,jobs:jobs.results.map(r=>({id:r.id,...JSON.parse(r.data)})),files,messages:messages.results,agentTasks:agentTasks.results});
 }catch(e){return teamError(e)}
}

export async function POST(req:Request){
 try{
  const me=await teamUser();
  const origin=req.headers.get('origin');
  if(origin&&origin!==new URL(req.url).origin)throw Error('FORBIDDEN');
  const input:any=await req.json();
  const action=z.string().parse(input.action);
  if(action==='resume.share'){
   const enabled=z.boolean().parse(input.enabled);
   await db().prepare('UPDATE team_members SET resume_shared=? WHERE email=?').bind(enabled?1:0,me.email).run();
   return reply({ok:true});
  }
  if(action==='recommendation.add'){
   const jobId=z.string().optional().parse(input.jobId);
   const job=jobId?await db().prepare('SELECT data FROM jobs WHERE id=?').bind(jobId).first<any>():null;
   const data=job?JSON.parse(job.data):z.object({company:z.string().min(1).max(160),title:z.string().min(1).max(200),url:z.string().url().refine(value=>value.startsWith('https://'),'请填写 HTTPS 岗位链接'),location:z.string().max(120),lane:z.string().max(100)}).parse(input);
   const note=z.string().max(1000).parse(input.note||'');
   const id=crypto.randomUUID();
   await db().prepare('INSERT OR IGNORE INTO team_recommendations(id,author_email,company,title,url,location,lane,note,created) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,me.email,data.company,data.title,data.url,data.location||'',data.lane||'',note,now()).run();
   const row=await db().prepare('SELECT id FROM team_recommendations WHERE url=?').bind(data.url).first<any>();
   return reply({id:row.id});
  }
  if(action==='recommendation.coapply'){
   const id=z.string().parse(input.id);
   await db().prepare('UPDATE team_recommendations SET coapply=1 WHERE id=?').bind(id).run();
   return reply({ok:true});
  }
  if(action==='plan.add'){
   const recommendationId=z.string().parse(input.recommendationId);
   const recommendation=await db().prepare('SELECT id FROM team_recommendations WHERE id=?').bind(recommendationId).first<any>();
   if(!recommendation)throw Error('岗位推荐不存在');
   const id=crypto.randomUUID(),created=now();
   await db().prepare('INSERT OR IGNORE INTO team_applications(id,member_email,recommendation_id,status,created,updated) VALUES(?,?,?,?,?,?)').bind(id,me.email,recommendationId,'queued',created,created).run();
   return reply({ok:true});
  }
  if(action==='application.update'){
   const id=z.string().parse(input.id);
   const status=z.enum(statuses).parse(input.status);
   const notes=z.string().max(8000).parse(input.notes||'');
   const details=z.string().max(8000).parse(input.details||'');
   const application=await db().prepare('SELECT status FROM team_applications WHERE id=? AND member_email=?').bind(id,me.email).first<any>();
   if(!application)throw Error('FORBIDDEN');
   if(status!==application.status&&status!=='queued'&&!details.trim())throw Error('请填写这次进度变化的依据');
   const updated=now();
   await db().prepare('UPDATE team_applications SET status=?,notes=?,updated=? WHERE id=?').bind(status,notes,updated,id).run();
   if(status!==application.status||details)await db().prepare('INSERT INTO team_application_events(id,application_id,status,details,created) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,status,details,updated).run();
   return reply({ok:true});
  }
  if(action==='message.post'){
   const content=z.string().trim().min(1).max(4000).parse(input.content);
   const authorKind=z.enum(['person','agent']).parse(input.authorKind);
   await db().prepare('INSERT INTO team_messages(id,member_email,author_kind,content,created) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),me.email,authorKind,content,now()).run();
   return reply({ok:true});
  }
  if(action==='agent_task.create'){
   const title=z.string().trim().min(1).max(180).parse(input.title);
   const details=z.string().max(4000).parse(input.details||'');
   const assignedToEmail=z.enum([OWNER_EMAIL,BROTHER_EMAIL]).nullable().parse(input.assignedToEmail||null);
   const id=crypto.randomUUID(),created=now();
   await db().prepare('INSERT INTO team_agent_tasks(id,created_by_email,assigned_to_email,title,details,status,created,updated) VALUES(?,?,?,?,?,?,?,?)').bind(id,me.email,assignedToEmail,title,details,'open',created,created).run();
   return reply({id});
  }
  if(action==='agent_task.update'){
   const id=z.string().parse(input.id);
   const status=z.enum(['open','doing','done']).parse(input.status);
   await db().prepare('UPDATE team_agent_tasks SET status=?,updated=? WHERE id=?').bind(status,now(),id).run();
   return reply({ok:true});
  }
  throw Error('未知操作');
 }catch(e){return teamError(e)}
}
