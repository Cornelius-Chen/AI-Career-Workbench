export type Check={value:'pass'|'fail'|'unknown';evidence:string;source:string;checkedAt:string};
export type Job={id:string;company:string;title:string;location:string;url:string;description:string;salaryMin:number|null;salaryMax:number|null;salaryText:string;lane:string;fitReason:string;founderValue:string;preparation:string;historicalChecked:string;historicalGrade:string;timing:string;visa:string;active:string;checkedAt:string|null;checks:Record<string,Check>;score:number;hidden:boolean;[key:string]:any};
export type Fact={id:string;category:string;label:string;text:string;source:string;confirmed:boolean;updated:string;tags:string[];historical?:boolean};
export type ApplicationLimit={companyGroup:string;titleKeywords:string[];maxAttempts:number;windowDays:number;evidence:string;sourceUrl:string;observedAt:string};
export function applicationLimitMatches(limit:ApplicationLimit,title:string){return limit.titleKeywords.length===0||limit.titleKeywords.some(keyword=>title.toLowerCase().includes(keyword.toLowerCase()))}
export function applicationLimitIsReached(limit:ApplicationLimit,title:string,attemptTitles:string[]){return applicationLimitMatches(limit,title)&&attemptTitles.filter(attemptTitle=>applicationLimitMatches(limit,attemptTitle)).length>=limit.maxAttempts}
export function requiredSpokenLanguage(title:string){
 const parenthesized=title.match(/\(([^()]+?)\s*(?:-|\s)\s*speaking\)/i)?.[1];
 const suffix=title.match(/[-–—]\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+speaking\s*$/i)?.[1];
 const bilingual=title.match(/\bbilingual\s*[-–—:]\s*([A-Za-z]+)\b/i)?.[1];
 const specialist=title.match(/\bLanguage Training Specialist\s*[-–—]\s*([A-Za-z]+)\b/i)?.[1];
 return (parenthesized||suffix||bilingual||specialist||( /\bmultilingual\b/i.test(title)?'multilingual':null))?.trim().toLowerCase()||null;
}
export function missingSpokenLanguage(title:string,facts:Fact[]){const language=requiredSpokenLanguage(title);return language&&!facts.some(f=>f.confirmed&&f.category==='Skills'&&f.tags.some(tag=>tag.toLowerCase()===`spoken-language:${language}`))?language:null}
export const defaultProfile={name:'',email:'',phone:'',location:'New York, NY',linkedin:'',github:'',graduation:'',startDate:'',degree:'',school:'',optStatus:'planned',currentAuthorization:'unknown',futureSponsorship:'unknown',confirmed:false};
export const defaultRules={minBase:90000,maxDaily:20,allowUnknownSponsorship:true,paused:false,historyReviewed:false,gmailStatus:'reauth_required',lastMailSync:null,lastMailAttempt:null,lastMailError:null,lastMailProcessed:0,lastMailActionable:0,lastMailUnmatched:0,lastJobSync:null,lastRun:null,timezone:'America/New_York'};
export const checkLabels:Record<string,string>={us:'美国工作地点',fulltime:'全职',timing:'2027 入职兼容',base:'基本年薪门槛',experience:'硬性经验要求',degree:'学历与专业',authorization:'工作授权要求'};
export const stageLabels:Record<string,string>={queued:'待投递',processing:'正在准备',submitting:'结果待核实',uncertain:'结果待核实',submitted:'已提交',assessment:'测评',interview:'面试',offer:'Offer',rejected:'拒绝',withdrawn:'撤回',blocked:'需要处理'};
export function activeApplicationBlock(application:{status:string;blockReason?:string|null}){return ['queued','processing','submitting','uncertain','blocked'].includes(application.status)?application.blockReason||'':'';}
export function canonical(url:string){const u=new URL(url);if(u.protocol!=='https:')throw Error('请提供 HTTPS 招聘链接');u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|source|ref|gh_src)/i.test(k))u.searchParams.delete(k);u.pathname=u.pathname.replace(/\/(application|apply)\/?$/,'').replace(/\/$/,'');if(u.hostname==='boards.greenhouse.io')u.hostname='job-boards.greenhouse.io';if(u.hostname==='job-boards.greenhouse.io'&&/\/jobs\/\d+$/.test(u.pathname)&&u.searchParams.get('gh_jid')===u.pathname.split('/').at(-1))u.searchParams.delete('gh_jid');return u.toString()}
export function requisitionKey(url:string){const u=new URL(canonical(url));const greenhouseId=u.hostname==='job-boards.greenhouse.io'?u.pathname.match(/\/jobs\/(\d+)$/)?.[1]:u.searchParams.get('gh_jid');return greenhouseId?`greenhouse:${greenhouseId}`:u.toString()}
export function companyGroup(company:string){return /tiktok|bytedance|lemon8|capcut/i.test(company)?'bytedance':company.toLowerCase().replace(/[^a-z0-9]/g,'')}
export function evaluate(job:Job,rules:any,now=Date.now()){
 const reasons:string[]=[];let excluded=false;
 if(job.active==='closed'){reasons.push('招聘已关闭');excluded=true}else if(job.active!=='active'||!job.checkedAt||now-Date.parse(job.checkedAt)>86400000)reasons.push('需要重新核验招聘状态');
 for(const [key,label] of Object.entries(checkLabels)){
 const c=job.checks?.[key];if(key==='authorization'&&(!c||c.value==='unknown')&&rules.allowUnknownSponsorship)continue;
 if(c?.value==='fail'){excluded=true;reasons.push(label+'不符合')}else if(!c||c.value!=='pass'||!c.evidence||!c.source||!Number.isFinite(Date.parse(c.checkedAt))||now-Date.parse(c.checkedAt)>7*86400000){reasons.push(label+'待核实')}
 }
 if(job.salaryMin==null||job.salaryMin<rules.minBase||job.checks?.base?.value!=='pass')if(!reasons.some(s=>s.startsWith('基本年薪')))reasons.push('基本年薪未达到已确认门槛');
 return {state:excluded?'excluded':reasons.length?'review':'ready',reasons};
}
export function rank(job:Job){const s=(job.title+' '+job.description).toLowerCase();let access=/new grad|entry.level|0\s*[-–]\s*2|early career|university graduate/.test(s)?38:12;if(/senior|staff|principal|lead engineer/i.test(job.title))access=0;const founder=(/customer|client|用户|客户/.test(s)?8:0)+(/deploy|production|上线/.test(s)?8:0)+(/evaluat|evals|reliab|cost|成本/.test(s)?7:0)+(/agent|rag|llm|generative|ai application/.test(s)?7:0);const cash=job.salaryMin?Math.min(20,Math.max(0,(job.salaryMin-100000)/5000)):0;return {total:Math.round(access+founder+cash),access,founder,cash};}
export function readiness(profile:any,rules:any,facts:Fact[]){const a=[];if(!profile.confirmed||!profile.name||!profile.email||!profile.phone)a.push('确认个人资料和申请联系方式');if(!facts.some(f=>f.confirmed&&f.category==='Experience')&&!facts.some(f=>f.confirmed&&f.category==='Projects'))a.push('至少确认一段项目或工作经历');if(!rules.historyReviewed)a.push('完成历史申请核对');if(rules.gmailStatus!=='connected')a.push('重新连接 Gmail 并同步');if(rules.paused)a.push('自动投递已暂停');return a;}
const order:Record<string,number>={queued:0,blocked:0,processing:0,submitting:0,uncertain:0,submitted:1,assessment:2,interview:3,offer:4};
export function reconcile(current:string,next:string,occurred:string,last:string){if(!Number.isFinite(Date.parse(occurred)))return{accept:false,reason:'缺少有效事件时间'};if(['rejected','withdrawn','offer'].includes(current)&&current!==next)return{accept:false,reason:'与已记录的终态冲突，需要核对'};if(Date.parse(occurred)<Date.parse(last))return{accept:false,reason:'早于当前进度的历史事件'};if(next==='rejected'||next==='withdrawn')return{accept:true,reason:''};if(current===next)return{accept:true,reason:''};if((order[next]??-1)<(order[current]??0))return{accept:false,reason:'早期阶段信息不会覆盖当前进度'};return{accept:true,reason:''};}
export function nyDay(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}
export function safeCsv(value:any){let s=String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}

export function resumeCurrent(resume:any,profile:any,facts:Fact[]){return resume.qa==='passed'&&JSON.stringify(resume.profileSnapshot)===JSON.stringify(profile)&&resume.factSnapshots?.length>0&&resume.factSnapshots.every((old:Fact)=>facts.some(f=>f.id===old.id&&f.confirmed&&f.text===old.text&&f.category===old.category));}

export function claimableApplication(a:{job_id:string;status:string;lease_until?:string|null},at:string,jobId?:string){return (!jobId||a.job_id===jobId)&&(a.status==='queued'||(!!jobId&&a.status==='blocked')||(a.status==='processing'&&!!a.lease_until&&a.lease_until<at))}
