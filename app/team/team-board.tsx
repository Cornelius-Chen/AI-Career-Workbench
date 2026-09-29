'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {Switch} from '@/components/ui/switch';
import {toast,Toaster} from 'sonner';
import {ArrowUpRight,BriefcaseBusiness,FileText,Handshake,LayoutDashboard,ListChecks,MapPinned,MessageCircle,Plus,ShieldCheck,Users,UserRound} from 'lucide-react';
import JobMap from './job-map';
import ApplicationBrowser from './application-browser';
import AgentRoom from './agent-room';
import AgentRecommendations from './agent-recommendations';
import CareerProfiles from './career-profiles';
import Workspace from '@/app/workspace';
import {registerTeamTools} from '@/lib/team-webmcp';

const stages:Record<string,string>={queued:'计划投递',processing:'准备中',submitting:'提交中',uncertain:'待确认',blocked:'需处理',submitted:'已投递',assessment:'测评',interview:'面试',offer:'Offer',rejected:'未通过',withdrawn:'已撤回'};
const progressed=new Set(['submitted','assessment','interview','offer','rejected','withdrawn']);
const tabs=[['mine','我的工作台',UserRound],['overview','双方概览',LayoutDashboard],['recommendations','共享岗位',BriefcaseBusiness],['applications','双方申请',ListChecks],['map','岗位地图',MapPinned],['room','Agent 协作',MessageCircle],['files','简历共享',FileText]] as const;
const date=(value:string)=>new Date(value).toLocaleDateString('zh-CN',{timeZone:'America/New_York',year:'numeric',month:'short',day:'numeric'});

export default function TeamBoard(){
 const [data,setData]=useState<any>(null),[view,setView]=useState('mine'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [editing,setEditing]=useState<any>(null);
 const [showAllFiles,setShowAllFiles]=useState(false);
 const load=useCallback(async()=>{const response=await fetch('/api/team',{cache:'no-store'});const body:any=await response.json();if(!response.ok)throw Error(body.error);setData(body);return body},[]);
 useEffect(()=>{load().catch(e=>setError(e.message))},[load]);
 const act=async(action:string,payload:any={},message='已保存')=>{
  setBusy(true);
  try{const response=await fetch('/api/team',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});const body:any=await response.json();if(!response.ok)throw Error(body.error);await load();toast.success(message);return body}
  catch(e:any){toast.error(e.message);return null}
  finally{setBusy(false)}
 };
 useEffect(()=>{const timer=setInterval(()=>load().catch(()=>{}),30000);return()=>clearInterval(timer)},[load]);
 useEffect(()=>registerTeamTools(async(action,payload)=>{const response=await fetch('/api/team',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});const body:any=await response.json();if(!response.ok)throw Error(body.error);return body},load),[load]);
 const members=data?.members||[];
 const applications=data?.applications||[];
 const recommendations=data?.recommendations||[];
 const agentNotes=data?.agentNotes||[];
 const agentTasks=data?.agentTasks||[];
 const stats=useMemo(()=>members.map((member:any)=>{
  const mine=applications.filter((a:any)=>a.memberEmail===member.email);
  const submitted=mine.filter((a:any)=>progressed.has(a.status)||a.events?.some((e:any)=>e.accepted!==false&&e.stage==='submitted')).length;
  const interview=mine.filter((a:any)=>['interview','offer'].includes(a.status)||a.events?.some((e:any)=>e.accepted!==false&&e.stage==='interview')).length;
  const offers=mine.filter((a:any)=>a.status==='offer'||a.events?.some((e:any)=>e.accepted!==false&&e.stage==='offer')).length;
  return {...member,total:mine.length,submitted,interview,offers,interviewRate:submitted?Math.round(interview/submitted*100):null,offerRate:submitted?Math.round(offers/submitted*100):null};
 }),[members,applications]);
 if(!data)return <main className="loading-page"><Users size={38}/><h1>双人求职空间</h1><p className="muted">{error||'正在读取共享记录…'}</p></main>;
 const me=data.me;
 const person=(email:string)=>members.find((m:any)=>m.email===email)?.name||email;
 const ownFiles=data.files.filter((f:any)=>f.memberEmail===me.email);
 const otherFiles=data.files.filter((f:any)=>f.memberEmail!==me.email);

 const upload=async(file:File)=>{setBusy(true);try{const form=new FormData();form.append('file',file);const response=await fetch('/api/team/files',{method:'POST',body:form});const body:any=await response.json();if(!response.ok)throw Error(body.error);await load();toast.success('简历已加密保存')}catch(e:any){toast.error(e.message)}finally{setBusy(false)}};
 const statCard=(s:any)=><section className="panel team-person" key={s.email}><div className="section-heading"><div><p className="eyebrow">{s.email===me.email?'我的进度':'伙伴进度'}</p><h2>{s.name}</h2></div><span className="pill">{s.total} 条申请记录</span></div><div className="team-numbers"><div><strong>{s.submitted}</strong><span>已投递</span></div><div><strong>{s.interview}</strong><span>进入面试</span></div><div><strong>{s.offers}</strong><span>Offer</span></div></div><p className="muted">面试率 {s.interviewRate===null?'暂无数据':s.interviewRate+'%'} · Offer 成功率 {s.offerRate===null?'暂无数据':s.offerRate+'%'}</p><small className="muted">按已投递岗位计算；计划投递不计入分母。</small></section>;
 return <div className="team-shell"><Toaster richColors position="top-right"/><header className="team-header"><div className="team-logo"><div className="brand-mark"><Handshake size={20}/></div><div><strong>AI 求职工作台</strong><small>双人协作空间</small></div></div><nav aria-label="协作导航">{tabs.map(([id,label,Icon])=><button key={id} type="button" className={view===id?'active':''} onClick={()=>setView(id)}><Icon size={17}/><span>{label}</span></button>)}</nav><div className="team-account"><span>{me.name}</span><a href="/api/auth/signout?return_to=/team" target="_top">退出</a></div></header><main className="team-main">
 {view==='overview'&&<><div className="page-heading"><div><p className="eyebrow">SHARED PROGRESS</p><h1>我们两人的求职进展</h1><p className="muted">申请分别记录，资料与证据在双方空间内同步。</p></div><Button variant="outline" onClick={()=>setView('applications')}>查看双方申请 <ArrowUpRight size={15}/></Button></div><div className="team-grid">{stats.map(statCard)}</div><CareerProfiles profiles={data.profiles} members={members} currentEmail={me.email} busy={busy} save={profile=>act('profile.save',{profile},'求职资料已更新')}/><div className="team-grid"><section className="panel"><div className="section-heading"><h2>最近确认的投递</h2><Button variant="ghost" onClick={()=>setView('applications')}>查看全部 <ArrowUpRight size={15}/></Button></div>{applications.filter((a:any)=>progressed.has(a.status)).slice(0,6).map((a:any)=><div className="team-row" key={a.id}><div><strong>{a.company} · {a.title}</strong><p className="muted">{person(a.memberEmail)} · {date(a.updated)}</p></div><span className="pill">{stages[a.status]||a.status}</span></div>)}</section><section className="panel"><div className="section-heading"><h2>Agent 的最新发现</h2><Button variant="ghost" onClick={()=>setView('room')}>协作空间 <ArrowUpRight size={15}/></Button></div>{agentNotes.slice(0,3).map((note:any)=><div className="team-row" key={note.id}><div><strong>{note.finding}</strong><p className="muted">{person(note.member_email)} 的 Agent · {note.nextAction}</p></div></div>)}{!agentNotes.length&&<p className="empty-copy">Agent 尚未留下有依据的发现。</p>}</section></div></>}
 {view==='mine'&&<><div className="page-heading"><div><p className="eyebrow">MY WORKBENCH</p><h1>我的工作台</h1><p className="muted">自己的申请、待办、岗位与资料都在这个入口。</p></div></div><div className="team-grid mine-stat">{stats.filter((s:any)=>s.email===me.email).map(statCard)}</div><CareerProfiles profiles={data.profiles} members={members} currentEmail={me.email} busy={busy} save={profile=>act('profile.save',{profile},'求职资料已更新')}/>{me.role==='owner'?<Workspace embedded/>:<ApplicationBrowser applications={applications} members={members} currentEmail={me.email} mineOnly onUpdate={a=>setEditing({...a,details:''})}/>}</>}
 {view==='recommendations'&&<AgentRecommendations recommendations={recommendations} applications={applications} members={members} profiles={data.profiles} currentEmail={me.email} busy={busy} act={act}/>}
 {view==='applications'&&<><div className="page-heading"><div><p className="eyebrow">APPLICATIONS</p><h1>双方申请</h1><p className="muted">按申请人、进度、岗位类型和地区查找；展开后查看具体依据。</p></div></div><div className="team-grid">{stats.map(statCard)}</div><ApplicationBrowser applications={applications} members={members} currentEmail={me.email} onUpdate={a=>setEditing({...a,details:''})}/></>}
 {view==='map'&&<><div className="page-heading"><div><p className="eyebrow">JOB MAP</p><h1>岗位地图</h1><p className="muted">默认显示所有已确认投递；无法定位的岗位仍在右侧列表。</p></div></div><JobMap recommendations={recommendations} applications={applications}/></>}
 {view==='room'&&<AgentRoom notes={agentNotes} tasks={agentTasks} requests={data.agentRequests} person={person} busy={busy} act={act}/>}
 {view==='files'&&<><div className="page-heading"><div><p className="eyebrow">RESUME PRIVACY</p><h1>简历共享</h1><p className="muted">共享开关由每个人自行控制；关闭时对方无法查看或下载你的简历。</p></div></div><section className="panel"><div className="rule-row"><div><h2>允许对方查看我的全部简历</h2><p className="muted">包含你已上传和生成的简历文件。默认关闭，随时可以撤销。</p></div><Switch aria-label="共享我的全部简历" checked={me.resumeShared} disabled={busy} onCheckedChange={enabled=>act('resume.share',{enabled},enabled?'简历共享已开启':'简历共享已关闭')}/></div><div className="section-heading mt-6"><div><h2>我的文件</h2><p className="muted">在这里新上传的文件使用 AES-GCM 加密保存。</p></div><label className="button-link cursor-pointer"><Plus size={15}/> 上传 PDF / DOCX<input className="sr-only" type="file" accept=".pdf,.docx" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)upload(file);e.currentTarget.value=''}}/></label></div>{ownFiles.slice(0,showAllFiles?ownFiles.length:20).map((f:any)=><div className="team-row" key={f.id}><div><strong>{f.name}</strong><p className="muted">{date(f.created)}</p></div><a className="button-link" href={f.url}>下载</a></div>)}{!ownFiles.length&&<p className="empty-copy">你还没有上传文件。</p>}{ownFiles.length>20&&<Button variant="ghost" onClick={()=>setShowAllFiles(!showAllFiles)}>{showAllFiles?'收起文件':`查看全部 ${ownFiles.length} 个文件`}</Button>}</section><section className="panel"><h2>对方已共享的文件</h2>{otherFiles.map((f:any)=><div className="team-row" key={f.id}><div><strong>{f.name}</strong><p className="muted">{person(f.memberEmail)} · {date(f.created)}</p></div><a className="button-link" href={f.url}>下载</a></div>)}{!otherFiles.length&&<p className="empty-copy">对方尚未开启简历共享，或还没有文件。</p>}</section><p className="muted"><ShieldCheck size={15} className="inline"/> 只有已授权账号可以进入协作空间。</p></>}
 </main>{editing&&<div className="team-modal-backdrop" role="presentation" onClick={()=>setEditing(null)}><div className="team-modal panel" role="dialog" aria-modal="true" aria-label="更新申请进度" onClick={e=>e.stopPropagation()}><h2>更新我的申请</h2><p className="muted">{editing.company} · {editing.title}</p><form className="team-form mt-5" onSubmit={async e=>{e.preventDefault();const r=await act('application.update',{id:editing.id,status:editing.status,notes:editing.notes,details:editing.details},'申请进度已更新');if(r)setEditing(null)}}><label>当前进度<select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})}>{['queued','submitted','assessment','interview','offer','rejected','withdrawn'].map(status=><option key={status} value={status}>{stages[status]}</option>)}</select></label><label>申请详情 / 备注<Textarea rows={4} value={editing.notes} onChange={e=>setEditing({...editing,notes:e.target.value})}/></label><label>这次变化的证据或说明<Textarea rows={3} value={editing.details} onChange={e=>setEditing({...editing,details:e.target.value})}/></label><div className="buttons"><Button disabled={busy} type="submit">保存进度</Button><Button variant="outline" type="button" onClick={()=>setEditing(null)}>取消</Button></div></form></div></div>}</div>;
}
