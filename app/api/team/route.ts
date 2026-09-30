import {z} from 'zod';
import {env} from 'cloudflare:workers';
import {db,setSetting} from '@/lib/store';
import {safeCsv} from '@/lib/domain';
import {workspacePreferences} from '@/lib/workspace-preferences';
import {OWNER_EMAIL,teamError,teamUser} from '@/lib/team';

export const dynamic='force-dynamic';
const reply=(value:any)=>Response.json(value,{headers:{'Cache-Control':'private, no-store'}});
const statuses=['queued','submitted','assessment','interview','offer','rejected','withdrawn'] as const;
const progressed=new Set(['submitted','assessment','interview','offer','rejected','withdrawn']);
const now=()=>new Date().toISOString();

export async function GET(req:Request){
 try{
  if(env.CAREER_ARCHIVED)return reply({archived:true});
  const me=await teamUser();
  const url=new URL(req.url);
  const view=url.searchParams.get('view');
  const preferences=await workspacePreferences(),collaborative=preferences.mode==='collaboration';
  if(view==='preferences')return reply(preferences);
  if(view==='export'){
   const legacy=me.email===OWNER_EMAIL?await db().prepare("SELECT json_extract(j.data,'$.company') AS company,json_extract(j.data,'$.title') AS title,json_extract(j.data,'$.url') AS url,a.status,json_extract(a.data,'$.notes') AS notes FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.status!='season_excluded'").all<any>():{results:[]};
   const plans=await db().prepare('SELECT r.company,r.title,r.url,a.status,a.notes FROM team_applications a JOIN team_recommendations r ON r.id=a.recommendation_id WHERE a.member_email=?').bind(me.email).all<any>();
   const rows=[['公司','岗位','官方链接','状态','备注'],...[...legacy.results,...plans.results].map(row=>[row.company,row.title,row.url,row.status,row.notes])];
   return new Response('\uFEFF'+rows.map(row=>row.map(safeCsv).join(',')).join('\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="applications.csv"','Cache-Control':'private, no-store'}});
  }
  if(!collaborative&&me.email!==OWNER_EMAIL&&['owner-applications','owner-events'].includes(view||''))return reply([]);
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
   view==='agent'&&(collaborative||me.email===OWNER_EMAIL)?db().prepare(`SELECT a.id,a.status,a.updated,a.data,json_extract(j.data,'$.company') AS company,json_extract(j.data,'$.title') AS title,json_extract(j.data,'$.url') AS url,json_extract(j.data,'$.location') AS location,json_extract(j.data,'$.lane') AS lane FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.status IN ('submitted','assessment','interview','offer','rejected','withdrawn') ORDER BY a.updated DESC`).all<any>():Promise.resolve({results:[]}),
   view==='agent'&&(collaborative||me.email===OWNER_EMAIL)?db().prepare("SELECT id,json_extract(data,'$.company') AS company,json_extract(data,'$.title') AS title,json_extract(data,'$.url') AS url,json_extract(data,'$.location') AS location,json_extract(data,'$.lane') AS lane,json_extract(data,'$.score') AS score,json_extract(data,'$.eligibility') AS eligibility FROM jobs WHERE COALESCE(json_extract(data,'$.hidden'),0)=0 ORDER BY CAST(json_extract(data,'$.score') AS REAL) DESC LIMIT 120").all<any>():Promise.resolve({results:[]}),
   db().prepare('SELECT * FROM team_files ORDER BY created DESC').all<any>(),
   db().prepare('SELECT id,name,type,created,data FROM files ORDER BY created DESC').all<any>(),
   db().prepare('SELECT * FROM team_messages ORDER BY created DESC LIMIT 100').all<any>(),
   db().prepare('SELECT * FROM team_agent_tasks ORDER BY updated DESC LIMIT 100').all<any>(),
   db().prepare('SELECT * FROM team_profiles').all<any>(),
   db().prepare("SELECT value FROM settings WHERE id='profile'").first<any>(),
   db().prepare('SELECT recommendation_id,member_email,decision FROM team_recommendation_decisions').all<any>(),
   db().prepare("SELECT status,COUNT(*) AS n FROM applications WHERE status!='season_excluded' GROUP BY status").all<{status:string,n:number}>()
  ]);
  const users=members.results.filter(member=>collaborative||member.email===me.email).map(m=>({...m,resumeShared:!!m.resume_shared}));
  const shared=(email:string)=>email===me.email||collaborative&&users.some(u=>u.email===email&&u.resumeShared);
  const ownerCounts=Object.fromEntries(ownerStatusCounts.results.map(row=>[row.status,row.n]));
  const ownerApplicationCount=collaborative||me.email===OWNER_EMAIL?ownerStatusCounts.results.reduce((sum,row)=>sum+row.n,0):0;
  const applications=[
   ...ownerApps.results.map(a=>{const data=JSON.parse(a.data);return {id:'legacy:'+a.id,memberEmail:OWNER_EMAIL,company:a.company,title:a.title,url:a.url,location:a.location||'',lane:a.lane||'',opportunityType:/\bintern(?:ship)?\b|实习/i.test(a.title)?'internship':'full_time',period:'',status:a.status,updated:a.updated,notes:data.notes||'',reference:data.reference||'',deadline:data.deadline||null,lastEvidence:data.lastEvidence||'',lastSource:data.lastSource||'',legacy:true,events:[]}}),
   ...teamApps.results.filter(a=>collaborative||a.member_email===me.email).map(a=>({id:a.id,memberEmail:a.member_email,company:a.company,title:a.title,url:a.url,location:a.location||'',lane:a.lane||'',opportunityType:a.opportunity_type,period:a.period,status:a.status,updated:a.updated,notes:a.notes,legacy:false,events:teamEvents.results.filter(e=>e.application_id===a.id).map(e=>({id:e.id,created:e.created,stage:e.status,evidence:e.details}))}))
  ].sort((a,b)=>b.updated.localeCompare(a.updated));
  const files=[
   ...teamFiles.results.filter(f=>shared(f.member_email)).map(f=>({id:f.id,memberEmail:f.member_email,name:f.name,type:f.type,size:f.size,created:f.created,url:'/api/team/files/'+f.id})),
   ...ownerFiles.results.filter(()=>shared(OWNER_EMAIL)).map(f=>({id:f.id,memberEmail:OWNER_EMAIL,name:f.name,type:f.type,size:JSON.parse(f.data).size||null,created:f.created,url:'/api/team/files/'+f.id}))
  ];
  const original=legacyProfile?JSON.parse(legacyProfile.value):{};
  const careerProfiles=users.map(member=>profiles.results.find(profile=>profile.member_email===member.email)||{member_email:member.email,headline:member.role==='owner'?[original.school,original.degree].filter(Boolean).join(' · '):'',location:member.role==='owner'?original.location||'':'',focus:'',skills:'',start_date:member.role==='owner'?original.startDate||'':'',target_type:'full_time',updated:''});
  const sharedRecommendations=recommendations.results.filter(r=>collaborative||r.target_email===me.email||r.author_email===me.email&&!r.target_email).map(r=>({...r,coapply:!!r.coapply,myDecision:decisions.results.find(d=>d.recommendation_id===r.id&&d.member_email===me.email)?.decision||''}));
  const agentNotes=messages.results.filter(message=>message.author_kind==='agent'&&(collaborative||message.member_email===me.email)).map(message=>({...message,...JSON.parse(message.content)}));
  const requests=messages.results.filter(message=>message.author_kind==='person'&&(collaborative||message.member_email===me.email));
  const candidates=jobs.results;
  const memberStats=users.map(member=>{
   const mine=applications.filter(application=>application.memberEmail===member.email&&!application.legacy);
   const legacy=member.email===OWNER_EMAIL?ownerCounts:{};
   return {email:member.email,applications:Object.values(legacy).reduce((sum,n)=>sum+Number(n),0)+mine.length,submitted:Object.entries(legacy).reduce((sum,[status,n])=>sum+(progressed.has(status)?Number(n):0),0)+mine.filter(application=>progressed.has(application.status)).length,uncertain:Number(legacy.uncertain||0)+mine.filter(application=>application.status==='uncertain').length,queued:Number(legacy.queued||0)+mine.filter(application=>application.status==='queued').length};
  });
  if(view==='agent')return reply({mode:preferences.mode,currentMemberEmail:me.email,members:users.map(({email,name,role}:any)=>({email,name,role})),profiles:careerProfiles,stats:memberStats,confirmedApplications:applications.filter(a=>progressed.has(a.status)).map(({memberEmail,company,title,status,location,lane,updated,url}:any)=>({memberEmail,company,title,status,location,lane,updated,url})),candidateJobs:candidates.map(({id,company,title,url,location,lane,score,eligibility}:any)=>({id,company,title,url,location,lane,score,eligibility,ownerStatus:applications.find(application=>application.memberEmail===OWNER_EMAIL&&application.url===url)?.status||''})),recommendations:sharedRecommendations,agentNotes,requests:requests.map(({id,member_email,content,created}:any)=>({id,memberEmail:member_email,content,created}))});
  return reply({entryUrl:new URL(req.url).origin+'/team',preferences,syncConfigured:!!env.CAREER_SYNC_CONFIGURED,me:{email:me.email,name:me.name,role:me.role,resumeShared:!!me.resume_shared,local:!!env.CAREER_LOCAL_MEMBER},members:users,profiles:careerProfiles,recommendations:sharedRecommendations,applications,ownerApplicationCount,files,agentNotes,agentRequests:requests.filter(message=>message.member_email===me.email),agentTasks:agentTasks.results.filter(task=>collaborative||task.created_by_email===me.email||task.assigned_to_email===me.email)});
 }catch(e){return teamError(e)}
}

export async function POST(req:Request){
 try{
  const me=await teamUser();
  const origin=req.headers.get('origin');
  if(origin&&origin!==new URL(req.url).origin)throw Error('FORBIDDEN');
  const input:any=await req.json();
  const action=z.string().parse(input.action);
  if(action==='workspace.mode'){
   const mode=z.enum(['solo','collaboration']).parse(input.mode);await setSetting('workspace.preferences',{mode});return reply({ok:true});
  }
  const collaborative=(await workspacePreferences()).mode==='collaboration';
  const memberEmail=async(value:string)=>{const email=z.string().parse(value);const member=await db().prepare('SELECT email FROM team_members WHERE email=?').bind(email).first();if(!member||!collaborative&&email!==me.email)throw Error('请选择当前空间中的成员');return email};
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
   const targetEmail=await memberEmail(input.targetEmail);
   const opportunityType=z.enum(['full_time','summer_intern']).parse(input.opportunityType);
   const period=z.string().trim().min(4).max(80).parse(input.period);
   const coapply=z.boolean().parse(input.coapply||false);
   const targetProfile=await db().prepare('SELECT target_type,start_date FROM team_profiles WHERE member_email=?').bind(targetEmail).first<any>();
   if(targetProfile.target_type!==opportunityType)throw Error('岗位类型与推荐对象的求职目标不符');
   const targetYear=targetProfile.start_date.match(/20\d{2}/)?.[0];
   if(targetYear&&!period.includes(targetYear))throw Error('岗位时间与推荐对象的目标年份不符');
   if(coapply){
    const profiles=await db().prepare('SELECT target_type,start_date FROM team_profiles').all<any>();
    const matching=profiles.results.filter(profile=>profile.target_type===opportunityType&&(!profile.start_date.match(/20\d{2}/)?.[0]||period.includes(profile.start_date.match(/20\d{2}/)[0])));
    if(!collaborative||matching.length<2)throw Error('共同申请需要至少两位成员的求职类型和目标年份符合');
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
   const assignedToEmail=input.assignedToEmail?await memberEmail(input.assignedToEmail):null;
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
