import {z} from 'zod';
import {db} from '@/lib/store';
import {OWNER_EMAIL,BROTHER_EMAIL,teamError,teamUser} from '@/lib/team';

export const dynamic='force-dynamic';
const reply=(value:any)=>Response.json(value,{headers:{'Cache-Control':'private, no-store'}});
const statuses=['queued','submitted','assessment','interview','offer','rejected','withdrawn'] as const;
const progressed=new Set(['submitted','assessment','interview','offer','rejected','withdrawn']);
const now=()=>new Date().toISOString();

export async function GET(req:Request){
 try{
  const me=await teamUser();
  const url=new URL(req.url);
  const view=url.searchParams.get('view');
  if(view==='owner-applications'){
   const cursor=url.searchParams.get('cursor')||'';
   const row=await db().prepare(`SELECT COALESCE(json_group_array(json_object(
    'id','legacy:'||a.id,'memberEmail',?,'company',a.company,'title',a.title,'url',a.url,
    'location',COALESCE(a.location,''),'lane',COALESCE(a.lane,''),
    'opportunityType',CASE WHEN lower(a.title) LIKE '%intern%' OR a.title LIKE '%实习%' THEN 'internship' ELSE 'full_time' END,
    'period','','status',a.status,'updated',a.updated,'notes',COALESCE(json_extract(a.data,'$.notes'),''),
    'reference',COALESCE(json_extract(a.data,'$.reference'),''),'deadline',json_extract(a.data,'$.deadline'),
    'lastEvidence',COALESCE(json_extract(a.data,'$.lastEvidence'),''),
    'lastSource',COALESCE(json_extract(a.data,'$.lastSource'),''),'legacy',json('true'),
    'events',json('[]')
   )),'[]') AS payload FROM (
    SELECT x.id,x.status,x.updated,x.data,json_extract(j.data,'$.company') AS company,
    json_extract(j.data,'$.title') AS title,json_extract(j.data,'$.url') AS url,
    json_extract(j.data,'$.location') AS location,json_extract(j.data,'$.lane') AS lane
    FROM applications x JOIN jobs j ON j.id=x.job_id
    WHERE x.id>? AND x.status!='season_excluded' ORDER BY x.id LIMIT 200
   ) a`).bind(OWNER_EMAIL,cursor).first<{payload:string}>();
   return new Response(row!.payload,{headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
  }
  if(view==='owner-events'){
   const cursor=url.searchParams.get('cursor')||'';
   const row=await db().prepare(`SELECT COALESCE(json_group_array(json_patch(json_object(
    'applicationId',e.application_id,'id',e.occurred,'created',e.occurred,'cursorId',e.id
   ),e.data)),'[]') AS payload FROM (
    SELECT id,application_id,occurred,data FROM events WHERE id>? AND application_id IS NOT NULL
    ORDER BY id LIMIT 200
   ) e`).bind(cursor).first<{payload:string}>();
   return new Response(row!.payload,{headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
  }
  const [members,recommendations,teamApps,teamEvents,ownerApps,jobs,teamFiles,ownerFiles,messages,agentTasks,profiles,legacyProfile,decisions,ownerStatusCounts]=await Promise.all([
   db().prepare('SELECT email,name,role,resume_shared FROM team_members ORDER BY role DESC,created').all<any>(),
   db().prepare('SELECT * FROM team_recommendations ORDER BY created DESC').all<any>(),
   db().prepare('SELECT a.*,r.company,r.title,r.url,r.location,r.lane,r.opportunity_type,r.period FROM team_applications a JOIN team_recommendations r ON r.id=a.recommendation_id ORDER BY a.updated DESC').all<any>(),
   db().prepare('SELECT * FROM team_application_events ORDER BY created DESC').all<any>(),
   view==='agent'?db().prepare(`SELECT a.id,a.status,a.updated,a.data,json_extract(j.data,'$.company') AS company,json_extract(j.data,'$.title') AS title,json_extract(j.data,'$.url') AS url,json_extract(j.data,'$.location') AS location,json_extract(j.data,'$.lane') AS lane FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.status IN ('submitted','assessment','interview','offer','rejected','withdrawn') ORDER BY a.updated DESC`).all<any>():Promise.resolve({results:[]}),
   view==='agent'?db().prepare("SELECT id,json_extract(data,'$.company') AS company,json_extract(data,'$.title') AS title,json_extract(data,'$.url') AS url,json_extract(data,'$.location') AS location,json_extract(data,'$.lane') AS lane,json_extract(data,'$.score') AS score,json_extract(data,'$.eligibility') AS eligibility FROM jobs WHERE COALESCE(json_extract(data,'$.hidden'),0)=0 ORDER BY CAST(json_extract(data,'$.score') AS REAL) DESC LIMIT 120").all<any>():Promise.resolve({results:[]}),
   db().prepare('SELECT * FROM team_files ORDER BY created DESC').all<any>(),
   db().prepare('SELECT id,name,type,created,data FROM files ORDER BY created DESC').all<any>(),
   db().prepare('SELECT * FROM team_messages ORDER BY created DESC LIMIT 100').all<any>(),
   db().prepare('SELECT * FROM team_agent_tasks ORDER BY updated DESC LIMIT 100').all<any>(),
   db().prepare('SELECT * FROM team_profiles').all<any>(),
   db().prepare("SELECT value FROM settings WHERE id='profile'").first<any>(),
   db().prepare('SELECT recommendation_id,member_email,decision FROM team_recommendation_decisions').all<any>(),
   db().prepare("SELECT status,COUNT(*) AS n FROM applications WHERE status!='season_excluded' GROUP BY status").all<{status:string,n:number}>()
  ]);
  const users=members.results.map(m=>({...m,resumeShared:!!m.resume_shared}));
  const shared=(email:string)=>email===me.email||users.some(u=>u.email===email&&u.resumeShared);
  const ownerCounts=Object.fromEntries(ownerStatusCounts.results.map(row=>[row.status,row.n]));
  const ownerApplicationCount=ownerStatusCounts.results.reduce((sum,row)=>sum+row.n,0);
  const applications=[
   ...ownerApps.results.map(a=>{const data=JSON.parse(a.data);return {id:'legacy:'+a.id,memberEmail:OWNER_EMAIL,company:a.company,title:a.title,url:a.url,location:a.location||'',lane:a.lane||'',opportunityType:/\bintern(?:ship)?\b|实习/i.test(a.title)?'internship':'full_time',period:'',status:a.status,updated:a.updated,notes:data.notes||'',reference:data.reference||'',deadline:data.deadline||null,lastEvidence:data.lastEvidence||'',lastSource:data.lastSource||'',legacy:true,events:[]}}),
   ...teamApps.results.map(a=>({id:a.id,memberEmail:a.member_email,company:a.company,title:a.title,url:a.url,location:a.location||'',lane:a.lane||'',opportunityType:a.opportunity_type,period:a.period,status:a.status,updated:a.updated,notes:a.notes,legacy:false,events:teamEvents.results.filter(e=>e.application_id===a.id).map(e=>({id:e.id,created:e.created,stage:e.status,evidence:e.details}))}))
  ].sort((a,b)=>b.updated.localeCompare(a.updated));
  const files=[
   ...teamFiles.results.filter(f=>shared(f.member_email)).map(f=>({id:f.id,memberEmail:f.member_email,name:f.name,type:f.type,size:f.size,created:f.created,url:'/api/team/files/'+f.id})),
   ...ownerFiles.results.filter(()=>shared(OWNER_EMAIL)).map(f=>({id:f.id,memberEmail:OWNER_EMAIL,name:f.name,type:f.type,size:JSON.parse(f.data).size||null,created:f.created,url:'/api/team/files/'+f.id}))
  ];
  const original=legacyProfile?JSON.parse(legacyProfile.value):{};
  const careerProfiles=users.map(member=>profiles.results.find(profile=>profile.member_email===member.email)||{member_email:member.email,headline:member.role==='owner'?[original.school,original.degree].filter(Boolean).join(' · '):'',location:member.role==='owner'?original.location||'':'',focus:'',skills:'',start_date:member.role==='owner'?original.startDate||'':'2027 夏季',target_type:member.role==='owner'?'full_time':'summer_intern',updated:''});
  const sharedRecommendations=recommendations.results.map(r=>({...r,coapply:!!r.coapply,myDecision:decisions.results.find(d=>d.recommendation_id===r.id&&d.member_email===me.email)?.decision||''}));
  const agentNotes=messages.results.filter(message=>message.author_kind==='agent').map(message=>({...message,...JSON.parse(message.content)}));
  const requests=messages.results.filter(message=>message.author_kind==='person');
  const candidates=jobs.results;
  if(view==='agent')return reply({members:users.map(({email,name,role}:any)=>({email,name,role})),profiles:careerProfiles,stats:users.map(member=>({email:member.email,applications:member.email===OWNER_EMAIL?ownerApplicationCount:applications.filter(a=>a.memberEmail===member.email).length,submitted:member.email===OWNER_EMAIL?Object.entries(ownerCounts).reduce((sum,[status,n])=>sum+(progressed.has(status)?Number(n):0),0):applications.filter(a=>a.memberEmail===member.email&&progressed.has(a.status)).length,uncertain:member.email===OWNER_EMAIL?Number(ownerCounts.uncertain||0):applications.filter(a=>a.memberEmail===member.email&&a.status==='uncertain').length,queued:member.email===OWNER_EMAIL?Number(ownerCounts.queued||0):applications.filter(a=>a.memberEmail===member.email&&a.status==='queued').length})),confirmedApplications:applications.filter(a=>progressed.has(a.status)).map(({memberEmail,company,title,status,location,lane,updated,url}:any)=>({memberEmail,company,title,status,location,lane,updated,url})),candidateJobs:candidates.map(({id,company,title,url,location,lane,score,eligibility}:any)=>({id,company,title,url,location,lane,score,eligibility,ownerStatus:applications.find(application=>application.memberEmail===OWNER_EMAIL&&application.url===url)?.status||''})),recommendations:sharedRecommendations,agentNotes,requests:requests.map(({id,member_email,content,created}:any)=>({id,memberEmail:member_email,content,created}))});
  return reply({me:{email:me.email,name:me.name,role:me.role,resumeShared:!!me.resume_shared},members:users,profiles:careerProfiles,recommendations:sharedRecommendations,applications,ownerApplicationCount,files,agentNotes,agentRequests:requests.filter(message=>message.member_email===me.email),agentTasks:agentTasks.results});
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
  if(action==='profile.save'){
   const profile=z.object({headline:z.string().trim().max(180),location:z.string().trim().max(120),focus:z.string().trim().max(300),skills:z.string().trim().max(500),startDate:z.string().trim().max(50),targetType:z.enum(['full_time','summer_intern'])}).parse(input.profile);
   await db().prepare('INSERT INTO team_profiles(member_email,headline,location,focus,skills,start_date,target_type,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(member_email) DO UPDATE SET headline=excluded.headline,location=excluded.location,focus=excluded.focus,skills=excluded.skills,start_date=excluded.start_date,target_type=excluded.target_type,updated=excluded.updated').bind(me.email,profile.headline,profile.location,profile.focus,profile.skills,profile.startDate,profile.targetType,now()).run();
   return reply({ok:true});
  }
  if(action==='recommendation.agent'){
   const jobId=z.string().optional().parse(input.jobId);
   const job=jobId?await db().prepare('SELECT data FROM jobs WHERE id=?').bind(jobId).first<any>():null;
   const data=job?JSON.parse(job.data):z.object({company:z.string().min(1).max(160),title:z.string().min(1).max(200),url:z.string().url().refine(value=>value.startsWith('https://'),'请填写 HTTPS 岗位链接'),location:z.string().max(120),lane:z.string().max(100)}).parse(input);
   const note=z.string().trim().min(20).max(1000).parse(input.note);
   const evidence=z.string().trim().min(8).max(1000).parse(input.evidence);
   const targetEmail=z.enum([OWNER_EMAIL,BROTHER_EMAIL]).parse(input.targetEmail);
   const opportunityType=z.enum(['full_time','summer_intern']).parse(input.opportunityType);
   const period=z.string().trim().min(4).max(80).parse(input.period);
   const coapply=z.boolean().parse(input.coapply||false);
   const targetProfile=await db().prepare('SELECT target_type,start_date FROM team_profiles WHERE member_email=?').bind(targetEmail).first<any>();
   if(targetProfile.target_type!==opportunityType)throw Error('岗位类型与推荐对象的求职目标不符');
   const targetYear=targetProfile.start_date.match(/20\d{2}/)?.[0];
   if(targetYear&&!period.includes(targetYear))throw Error('岗位时间与推荐对象的目标年份不符');
   if(coapply){
    const otherEmail=targetEmail===OWNER_EMAIL?BROTHER_EMAIL:OWNER_EMAIL;
    const otherProfile=await db().prepare('SELECT target_type FROM team_profiles WHERE member_email=?').bind(otherEmail).first<any>();
    if(otherProfile.target_type!==opportunityType)throw Error('两人的求职类型不同，请分别推荐对应岗位');
   }
   const id=crypto.randomUUID();
   await db().prepare("INSERT INTO team_recommendations(id,author_email,company,title,url,location,lane,note,source_kind,target_email,opportunity_type,period,evidence,coapply,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET author_email=excluded.author_email,note=excluded.note,source_kind='agent',target_email=excluded.target_email,opportunity_type=excluded.opportunity_type,period=excluded.period,evidence=excluded.evidence,coapply=excluded.coapply").bind(id,me.email,data.company,data.title,data.url,data.location||'',data.lane||'',note,'agent',coapply?'':targetEmail,opportunityType,period,evidence,coapply?1:0,now()).run();
   const row=await db().prepare('SELECT id FROM team_recommendations WHERE url=?').bind(data.url).first<any>();
   return reply({id:row.id});
  }
  if(action==='recommendation.dismiss'){
   const id=z.string().parse(input.id);
   await db().prepare("INSERT INTO team_recommendation_decisions(id,recommendation_id,member_email,decision,created) VALUES(?,?,?,?,?) ON CONFLICT(member_email,recommendation_id) DO UPDATE SET decision='skip',created=excluded.created").bind(crypto.randomUUID(),id,me.email,'skip',now()).run();
   return reply({ok:true});
  }
  if(action==='recommendation.restore'){
   const id=z.string().parse(input.id);
   await db().prepare('DELETE FROM team_recommendation_decisions WHERE member_email=? AND recommendation_id=?').bind(me.email,id).run();
   return reply({ok:true});
  }
  if(action==='recommendation.coapply'){
   const id=z.string().parse(input.id);
   await db().prepare('UPDATE team_recommendations SET coapply=1 WHERE id=?').bind(id).run();
   return reply({ok:true});
  }
  if(action==='plan.add'){
   const recommendationId=z.string().parse(input.recommendationId);
   const recommendation=await db().prepare('SELECT id,target_email,opportunity_type,period FROM team_recommendations WHERE id=?').bind(recommendationId).first<any>();
   if(!recommendation)throw Error('岗位推荐不存在');
   if(recommendation.target_email&&recommendation.target_email!==me.email)throw Error('这个岗位推荐给另一位成员');
   const profile=await db().prepare('SELECT target_type,start_date FROM team_profiles WHERE member_email=?').bind(me.email).first<any>();
   if(profile.target_type!==recommendation.opportunity_type)throw Error('岗位类型与你的求职目标不符');
   const targetYear=profile.start_date.match(/20\d{2}/)?.[0];
   if(targetYear&&!recommendation.period.includes(targetYear))throw Error('岗位时间与你的求职目标不符');
   const id=crypto.randomUUID(),created=now();
   await db().prepare('INSERT OR IGNORE INTO team_applications(id,member_email,recommendation_id,status,created,updated) VALUES(?,?,?,?,?,?)').bind(id,me.email,recommendationId,'queued',created,created).run();
   await db().prepare('DELETE FROM team_recommendation_decisions WHERE member_email=? AND recommendation_id=?').bind(me.email,recommendationId).run();
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
  if(action==='agent.request'){
   const content=z.string().trim().min(1).max(4000).parse(input.content);
   await db().prepare('INSERT INTO team_messages(id,member_email,author_kind,content,created) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),me.email,'person',content,now()).run();
   return reply({ok:true});
  }
  if(action==='agent.note'){
   const note=z.object({finding:z.string().trim().min(12).max(600),evidence:z.string().trim().min(12).max(1200),nextAction:z.string().trim().min(8).max(600),sourceUrl:z.string().url().optional()}).parse(input);
   await db().prepare('INSERT INTO team_messages(id,member_email,author_kind,content,created) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),me.email,'agent',JSON.stringify(note),now()).run();
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
