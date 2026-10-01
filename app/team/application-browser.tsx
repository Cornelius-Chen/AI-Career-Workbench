'use client';
import {t as tr,useLanguage,dateLocale} from '@/lib/i18n';
import {useMemo,useState,type ReactNode} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {careerLane,careerLanes,careerRegion,careerRegions} from '@/lib/career-filters';

const labels:Record<string,string>={queued:'计划投递',processing:'准备中',submitting:'提交中',uncertain:'待确认',blocked:'需处理',submitted:'已投递',assessment:'测评',interview:'面试',offer:'Offer',rejected:'未通过',withdrawn:'已撤回'};
const stageOrder:Record<string,number>={offer:0,interview:1,assessment:2,blocked:3,uncertain:4,submitting:5,processing:6,submitted:7,queued:8,rejected:9,withdrawn:10};
const opportunityLabels:Record<string,string>={full_time:'全职',summer_intern:'暑期实习',internship:'实习（年份未核实）'};
const pageSize=24;

export default function ApplicationBrowser({applications,members,currentEmail,mineOnly=false,onUpdate,renderActions}:{applications:any[];members:any[];currentEmail:string;mineOnly?:boolean;onUpdate:(application:any)=>void;renderActions?:(application:any)=>ReactNode}){
 useLanguage();
 const [query,setQuery]=useState(''),[status,setStatus]=useState('全部进度'),[opportunityType,setOpportunityType]=useState('全部求职类型'),[lane,setLane]=useState('全部类型'),[region,setRegion]=useState('全部地区'),[member,setMember]=useState('全部成员'),[sort,setSort]=useState('待办优先'),[page,setPage]=useState(1);
 const memberNames=useMemo(()=>new Map(members.map(person=>[person.email,person.name])),[members]);
 const name=(email:string)=>memberNames.get(email)||email;
 const classifications=useMemo(()=>new Map(applications.map(application=>[application,{lane:careerLane(application),region:careerRegion(application.location||''),search:`${application.company} ${application.title} ${application.location} ${application.notes||''}`.toLowerCase()}])),[applications]);
 const search=query.toLowerCase();
 const filtered=useMemo(()=>applications.filter(a=>{
  if(mineOnly&&a.memberEmail!==currentEmail)return false;
  if(!mineOnly&&member!=='全部成员'&&a.memberEmail!==member)return false;
  if(status!=='全部进度'&&a.status!==status)return false;
  if(opportunityType!=='全部求职类型'&&a.opportunityType!==opportunityType)return false;
  if(lane!=='全部类型'&&classifications.get(a)!.lane!==lane)return false;
  if(region!=='全部地区'&&classifications.get(a)!.region!==region)return false;
  return !search||classifications.get(a)!.search.includes(search);
 }).sort((a,b)=>sort==='公司名称'?a.company.localeCompare(b.company):sort==='最近更新'?b.updated.localeCompare(a.updated):(stageOrder[a.status]??8)-(stageOrder[b.status]??8)||b.updated.localeCompare(a.updated)),[applications,classifications,currentEmail,lane,member,mineOnly,opportunityType,region,search,sort,status]);
 const setFilter=(setter:(value:string)=>void)=>(event:React.ChangeEvent<HTMLSelectElement>)=>{setter(event.target.value);setPage(1)};
 const shown=filtered.slice((page-1)*pageSize,page*pageSize);
 const first=filtered.length?(page-1)*pageSize+1:0;
 return <section className="panel application-browser"><div className="application-filters"><Input aria-label={tr("搜索申请")} placeholder={tr("搜索公司、岗位、地点、备注")} value={query} onChange={event=>{setQuery(event.target.value);setPage(1)}}/><select aria-label={tr("申请进度")} value={status} onChange={setFilter(setStatus)}><option value={"全部进度"}>{tr("全部进度")}</option>{Object.entries(labels).map(([key,value])=><option key={key} value={key}>{tr(value)}</option>)}</select><select aria-label={tr("求职类型")} value={opportunityType} onChange={setFilter(setOpportunityType)}><option value={"全部求职类型"}>{tr("全部求职类型")}</option>{Object.entries(opportunityLabels).map(([key,value])=><option key={key} value={key}>{tr(value)}</option>)}</select><select aria-label={tr("岗位类型")} value={lane} onChange={setFilter(setLane)}>{careerLanes.map(value=><option key={value} value={value}>{tr(value)}</option>)}</select><select aria-label={tr("工作地区")} value={region} onChange={setFilter(setRegion)}>{careerRegions.map(value=><option key={value} value={value}>{tr(value)}</option>)}</select>{!mineOnly&&<select aria-label={tr("申请人")} value={member} onChange={setFilter(setMember)}><option value={"全部成员"}>{tr("全部成员")}</option>{members.map(person=><option key={person.email} value={person.email}>{person.name}</option>)}</select>}<select aria-label={tr("排序")} value={sort} onChange={setFilter(setSort)}><option value={"待办优先"}>{tr("待办优先")}</option><option value={"最近更新"}>{tr("最近更新")}</option><option value={"公司名称"}>{tr("公司名称")}</option></select></div><div className="application-results"><strong>{filtered.length} {tr("条申请")}</strong><span>{tr("每页")+' '}{pageSize} {tr("条 · 第")+' '}{page} {tr("页")}</span></div>{shown.map(a=><details className="application-compact" key={a.id}><summary><span className="application-company">{a.company}<small>{mineOnly?tr("我的申请"):name(a.memberEmail)}</small></span><span className="application-title">{a.title}<small>{a.location||tr("地点待确认")} · {tr(opportunityLabels[a.opportunityType])} · {tr(classifications.get(a)!.lane)} · {tr(classifications.get(a)!.region)}</small></span><span className="pill">{tr(labels[a.status]||a.status)}</span></summary><div className="application-expanded"><p className="muted">{tr("最近更新：")}{new Date(a.updated).toLocaleDateString(dateLocale())} · <a href={a.url} target="_blank" rel="noreferrer">{tr("官方岗位 ↗")}</a></p>{a.notes&&<p className="whitespace-pre-wrap">{a.notes}</p>}{a.lastEvidence&&<p className="muted whitespace-pre-wrap">{tr("最新依据：")}{a.lastEvidence}</p>}{a.events?.length>0&&<details><summary>{tr("进度依据 ·")+' '}{a.events.length} {tr("条")}</summary>{a.events.map((event:any,index:number)=><p className="muted" key={event.id||index}>{tr(labels[event.stage]||event.stage||tr("记录"))} · {event.evidence||event.details||tr("暂无说明")} {event.sourceUrl&&<a href={event.sourceUrl} target="_blank" rel="noreferrer">{tr("来源 ↗")}</a>}</p>)}</details>}{a.memberEmail===currentEmail&&!a.legacy&&<Button variant="outline" size="sm" onClick={()=>onUpdate(a)}>{tr("更新进度")}</Button>}{renderActions?.(a)}</div></details>)}{!shown.length&&<p className="empty-copy">{tr("当前条件下没有申请。调整筛选后再查看。")}</p>}<div className="application-pagination"><Button variant="outline" size="sm" disabled={page===1} onClick={()=>setPage(page-1)}>{tr("上一页")}</Button><span>{first}–{Math.min(page*pageSize,filtered.length)} / {filtered.length}</span><Button variant="outline" size="sm" disabled={page*pageSize>=filtered.length} onClick={()=>setPage(page+1)}>{tr("下一页")}</Button></div></section>;
}
