import seedJobs from '@/data/jobs.json';
import {type Job,canonical,rank} from './domain';
import {db,saveJob,getSetting,setSetting} from './store';
import {selectDiscoveryBatch,readBoardJson,greenhouseDiscoveryJobs,knownDiscoveryKeys} from './discovery';
import {leverPostingInfo,parseLeverPosting} from './lever';
import {officialEmployerHosts,structuredBoardInfo,hasEmployerApplicationLink} from './official-sources';
const hosts=new Set([...(seedJobs as {url:string}[]).map(j=>new URL(j.url).hostname),...officialEmployerHosts]);
export function allowedUrl(value:string){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('仅接受公开 HTTPS 招聘网页');if(!hosts.has(u.hostname)&&!['api.ashbyhq.com','boards-api.greenhouse.io','jobs.ashbyhq.com','boards.greenhouse.io','job-boards.greenhouse.io','jobs.lever.co','api.lever.co'].includes(u.hostname))throw Error('该来源尚未登记，请在 Codex 中核验并添加官方来源');return u;}
export async function publicFetch(url:string){let u=allowedUrl(url);for(let i=0;i<4;i++){const r=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(18000),headers:{Accept:'application/json,text/html','User-Agent':'CareerWorkspace/1.0'}});if(r.status>=300&&r.status<400){u=allowedUrl(new URL(r.headers.get('location')||'',u).href);continue}return r}throw Error('招聘网页重定向次数过多')}
function plain(s:string){return s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/\s+/g,' ').trim()}
const boardInfo=structuredBoardInfo;
export async function refreshJob(job:Job){const now=new Date().toISOString();const b=boardInfo(job.url),lever=leverPostingInfo(job.url);let desc='',location=job.location,active='unknown',employment='',newTitle=job.title,error='';
 try{if(b?.type==='greenhouse'){const r=await publicFetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b.board)}/jobs/${encodeURIComponent(b.id)}?questions=true`);if(r.ok){const j:any=await r.json();if(j.id&&j.title&&j.content){desc=plain(j.content);location=j.location?.name||location;newTitle=j.title;active='active'}}else if(r.status===404)active='closed';else error='来源返回 '+r.status}
 else if(b?.type==='ashby'){const r=await publicFetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(b.board)}?includeCompensation=true`);if(r.ok){const data:any=await r.json();if(!Array.isArray(data.jobs))throw Error('来源数据格式变化');const j=data.jobs.find((v:any)=>v.jobUrl&&boardInfo(v.jobUrl)?.id===b.id);if(j&&j.isListed!==false){desc=j.descriptionPlain||plain(j.descriptionHtml||'');location=j.location||location;newTitle=j.title;employment=j.employmentType||'';active=j.applyUrl?'active':'unknown'}else active='closed'}else error='来源返回 '+r.status}
 else if(lever){const r=await publicFetch(`https://api.lever.co/v0/postings/${encodeURIComponent(lever.board)}/${encodeURIComponent(lever.id)}?mode=json`);if(r.ok){const j=parseLeverPosting(await readBoardJson(r),lever);desc=j.description;location=j.location||location;employment=j.employment;newTitle=j.title;active='active'}else if([404,410].includes(r.status))active='closed';else error='Lever 来源返回 '+r.status}
 // A failed structured Lever response stays unknown; generic page text must not override it.
 if(!lever&&!desc&&active!=='closed'){const r=await publicFetch(job.url);if(r.ok){const html=await r.text();const text=plain(html);if(/position has been filled|job is no longer available|job has been closed|no longer accepting applications/i.test(text))active='closed';else if(text.toLowerCase().includes(job.title.toLowerCase())&&(/submit application|apply for this job|apply now/i.test(text)||hasEmployerApplicationLink(job.url,html))){active='active';desc=text}else error='页面可访问，但尚未确认对应岗位及申请入口'}else if([404,410].includes(r.status))active='closed';else error='来源暂不可读取 ('+r.status+')'}
 }catch(e:any){error=e.message}
 const changed=!!desc&&desc!==job.description;const checks=changed?{}:{...job.checks};
 const c=(value:'pass'|'fail',evidence:string)=>({value,evidence,source:job.url,checkedAt:now});
 if(/\b(United States|USA|US|New York|San Francisco|California|Seattle|Austin|Boston|Palo Alto|Mountain View)\b/.test(location)||/\b[A-Z]{2}\b/.test(location)&&/\b(CA|NY|TX|MA|WA|FL|IL|CO|VA|NC|GA|AZ|UT|OH|PA|NJ)\b/.test(location))checks.us=c('pass',location);
 if(/full.?time/i.test(employment))checks.fulltime=c('pass',employment);
 if(/\b(internship|intern)\b/i.test(newTitle))checks.fulltime=c('fail',newTitle);
 const timing=desc.match(/.{0,100}(?:graduate|graduation|graduating|start date|start in).{0,100}(?:2026|2027).{0,100}/i);
 // Timing, salary, degree and experience require contextual review, never title-only inference.
 const j={...job,title:newTitle,location,description:desc||job.description,active,checkedAt:now,checks,refreshError:error,sourceExcerpt:desc.slice(0,800),timingExcerpt:timing?.[0]||'',reviewNeeded:changed};await saveJob(j);return j;
}
export async function discover(){
 // Read only the small source index, never every saved job description.
 const index=await db().prepare("SELECT canonical,json_extract(data,'$.url') AS url,json_extract(data,'$.company') AS company FROM jobs ORDER BY rowid").all<any>();
 const known=knownDiscoveryKeys(index.results.map(j=>j.url),canonical,boardInfo);
 let state=await getSetting('discoveryState');
 if(!state){const boards=[...new Map(index.results.map(j=>{const b=boardInfo(j.url);return[b?b.type+':'+b.board:'',b?{...b,company:j.company}:null]})).values()].filter(Boolean);state={boards,cursor:Math.min(await getSetting('sourceCursor',0),Math.max(0,boards.length-1)),reports:[]};await setSetting('discoveryState',state);}
 const b=state.boards[state.cursor];let added=0,pending=false;let report:any;
 if(b){try{
  // Greenhouse supports a lightweight listing; fetch descriptions later per job.
  const url=b.type==='ashby'?`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(b.board)}`:`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b.board)}/jobs`;
  const r=await publicFetch(url);if(!r.ok)throw Error('HTTP '+r.status);
  const d=await readBoardJson(r);if(!Array.isArray(d.jobs))throw Error('岗位列表格式变化');
  const candidates=b.type==='greenhouse'?greenhouseDiscoveryJobs(b.board,d.jobs):d.jobs;
  const batch=selectDiscoveryBatch(candidates,known,canonical);pending=batch.pending;
  for(const v of batch.selected){const url=v.jobUrl||v.absolute_url;allowedUrl(url);const at=new Date().toISOString();
   const j:Job={id:crypto.randomUUID(),company:b.company,title:v.title,location:typeof v.location==='string'?v.location:v.location?.name||'',url,description:'',salaryMin:null,salaryMax:null,salaryText:'待核实',lane:'新增 AI / 软件工程线索',fitReason:'来自公司公开招聘列表，职位全文和申请入口待核验',founderValue:'',preparation:'',historicalChecked:'',historicalGrade:'',timing:'待核实',visa:'未知',active:'unknown',checkedAt:null,checks:{},score:0,hidden:false};j.score=rank(j).total;
   // A retry or concurrent scan must never overwrite an existing reviewed job.
   const result=await db().prepare('INSERT OR IGNORE INTO jobs(id,canonical,data,updated) VALUES(?,?,?,?)').bind(j.id,canonical(url),JSON.stringify(j),at).run();added+=Number(result.meta.changes||0);
  }report={board:b.board,status:pending?'partial':'success'};
 }catch(e:any){report={board:b.board,status:'failed',error:e.message};pending=false;}}
 const next=pending?state.cursor:state.cursor+1;
 const complete=next>=state.boards.length;
 const reports=report?[...state.reports.filter((r:any)=>r.board!==b.board),report]:state.reports;
 const result={added,boards:state.boards.length,next:complete?0:next,pending,complete,reports};
 await setSetting('discoveryState',complete?null:{...state,cursor:next,reports});
 await setSetting('sourceCursor',result.next);
 await setSetting('sourceReports',{at:new Date().toISOString(),boards:result.boards,cursor:result.next,pending,complete,reports});
 return result;
}
