'use client';
import {useMemo,useState} from 'react';
import {geoAlbersUsa,geoPath} from 'd3-geo';
import {feature} from 'topojson-client';
import states from 'us-atlas/states-10m.json';

const places:[RegExp,string,number,number][]=[
 [/san francisco|\bsf\b|bay area|foster city|san mateo|alameda|sunnyvale|santa clara|san jose|mountain view|menlo park|palo alto|cupertino|redwood city|livermore|milpitas/i,'旧金山湾区',-122.2,37.6],
 [/new york|\bnyc\b|brooklyn|manhattan|greenwich|stamford|norwalk/i,'纽约都会区',-73.98,40.73],
 [/seattle|redmond/i,'西雅图',-122.33,47.61],
 [/los angeles|santa monica|long beach|costa mesa|universal city/i,'洛杉矶',-118.24,34.05],
 [/boston|cambridge|north reading|framingham/i,'波士顿',-71.06,42.36],
 [/chicago/i,'芝加哥',-87.63,41.88],
 [/austin/i,'奥斯汀',-97.74,30.27],
 [/dallas|plano|irving|frisco/i,'达拉斯',-96.8,32.78],
 [/san antonio/i,'圣安东尼奥',-98.49,29.42],
 [/houston|spring, texas/i,'休斯敦',-95.37,29.76],
 [/washington|arlington|reston|ashburn|mclean|bethesda|fort belvoir|fort meade|annapolis junction/i,'华盛顿都会区',-77.04,38.9],
 [/atlanta|alpharetta/i,'亚特兰大',-84.39,33.75],
 [/charlotte|morrisville|raleigh|fort bragg/i,'北卡罗来纳',-80.94,35.23],
 [/denver|boulder/i,'丹佛',-104.99,39.74],
 [/san diego/i,'圣迭戈',-117.16,32.72],
 [/nashville/i,'纳什维尔',-86.78,36.16],
 [/cincinnati/i,'辛辛那提',-84.51,39.1],
 [/des moines/i,'得梅因',-93.62,41.59],
 [/indianapolis/i,'印第安纳波利斯',-86.16,39.77],
 [/kansas city/i,'堪萨斯城',-94.58,39.1],
 [/st. louis/i,'圣路易斯',-90.2,38.63],
 [/ann arbor|detroit/i,'底特律都会区',-83.05,42.35],
 [/miami/i,'迈阿密',-80.19,25.76],
 [/tampa/i,'坦帕',-82.46,27.95],
 [/phoenix/i,'凤凰城',-112.07,33.45],
 [/orlando/i,'奥兰多',-81.38,28.54],
 [/boise/i,'博伊西',-116.2,43.62]
];
const colors:Record<string,string>={AI:'#6558df',ML:'#ef6195',Data:'#3388c9',FDE:'#ed9a35',Engineering:'#39aa87',Other:'#8994a7'};
const opportunityLabels:Record<string,string>={full_time:'全职',summer_intern:'暑期实习',internship:'实习（年份未核实）'};
function kind(job:any){const value=(job.title||job.lane||'').toLowerCase();if(/forward deployed|\bfde\b/.test(value))return 'FDE';if(/data scien|analytic|statistic|data engineer/.test(value))return 'Data';if(/machine learning|\bml\b|deep learning/.test(value))return 'ML';if(/\bai\b|agent|llm|rag/.test(value))return 'AI';if(/engineer|developer/.test(value))return 'Engineering';return 'Other'}
function place(location:string){return places.find(([pattern])=>pattern.test(location||''))}
const projection=geoAlbersUsa().fitSize([840,500],feature(states as any,(states as any).objects.states) as any);
const path=geoPath(projection);
const shapes=(feature(states as any,(states as any).objects.states) as any).features;

export default function JobMap({recommendations,applications}:{recommendations:any[],applications:any[]}){
 const [mode,setMode]=useState<'recommended'|'applied'>('applied');
 const [typeFilter,setTypeFilter]=useState<'all'|'full_time'|'summer_intern'|'internship'>('all');
 const [active,setActive]=useState<string|null>(null);
 const confirmed=applications.filter(a=>['submitted','assessment','interview','offer','rejected','withdrawn'].includes(a.status));
 const source=(mode==='recommended'?recommendations.filter(r=>r.source_kind==='agent'):confirmed).filter(job=>typeFilter==='all'||(job.opportunityType||job.opportunity_type)===typeFilter);
 const mapped=useMemo(()=>source.map((job:any)=>({job,location:place(job.location),kind:kind(job)})),[source]);
 const visible=mapped.filter(x=>x.location);
 const unknown=mapped.filter(x=>!x.location);
 const groups=Object.values(visible.reduce((result:any,item:any)=>{const p=item.location!,key=p[1]+':'+item.kind;(result[key]??={key,place:p[1],coords:[p[2],p[3]],kind:item.kind,jobs:[]}).jobs.push(item.job);return result},{})) as {key:string,place:string,coords:[number,number],kind:string,jobs:any[]}[];
 const selected=groups.find(group=>group.key===active)||groups[0];
 return <div className="team-map-layout"><div><div className="buttons mb-4"><button className={mode==='applied'?'map-choice active':'map-choice'} onClick={()=>{setMode('applied');setActive(null)}}>已确认投递 {confirmed.length}</button><button className={mode==='recommended'?'map-choice active':'map-choice'} onClick={()=>{setMode('recommended');setActive(null)}}>Agent 推荐 {recommendations.filter(r=>r.source_kind==='agent').length}</button></div><div className="buttons mb-4">{([['all','全部'],['full_time','全职'],['summer_intern','暑期实习'],['internship','其他实习']] as const).map(([value,label])=><button key={value} className={typeFilter===value?'map-choice active':'map-choice'} onClick={()=>{setTypeFilter(value);setActive(null)}}>{label}</button>)}</div><svg viewBox="0 0 840 500" className="team-map" role="img" aria-label="美国岗位分布地图"><rect width="840" height="500" rx="16" fill="var(--map-background)"/>{shapes.map((shape:any)=><path key={shape.id} d={path(shape)||''} fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="1"/>)}{groups.map(group=>{const placeGroups=groups.filter(item=>item.place===group.place),index=placeGroups.findIndex(item=>item.key===group.key),angle=2*Math.PI*index/placeGroups.length;const point=projection(group.coords)!;const x=point[0]+(placeGroups.length>1?23*Math.cos(angle):0),y=point[1]+(placeGroups.length>1?23*Math.sin(angle):0);const radius=Math.min(20,6+Math.sqrt(group.jobs.length)*2.2);return <g key={group.key} onClick={()=>setActive(group.key)} className="map-bubble" tabIndex={0} role="button" aria-label={`${group.place} ${group.kind} ${group.jobs.length} 个岗位`} onKeyDown={e=>{if(e.key==='Enter')setActive(group.key)}}><circle cx={x} cy={y} r={radius+5} fill={colors[group.kind]} opacity=".12"/><circle cx={x} cy={y} r={radius} fill={colors[group.kind]} fillOpacity=".88" stroke="var(--map-background)" strokeWidth="2"/><text x={x} y={y+4} textAnchor="middle" fill="white" fontSize="11" fontWeight="700">{group.jobs.length}</text></g>})}</svg><div className="map-legend">{Object.entries(colors).map(([name,color])=><span key={name}><i style={{background:color}}/>{name}</span>)}</div><p className="muted text-sm mt-3">共 {source.length} 条，地图定位 {visible.length} 条；另有 {unknown.length} 条在右侧列出。每条记录只计一次，气泡数字为同地区同类型的条数。</p>{mode==='applied'&&<p className="muted text-sm">“待确认”申请不计入已投递。</p>}</div><div className="panel map-details"><p className="eyebrow">地图上的机会</p><h3>{selected?`${selected.place} · ${selected.kind}`:'暂无可定位岗位'}</h3><div className="map-job-list">{selected?.jobs.map((job:any,index:number)=><a key={job.id||job.url||index} href={job.url} target="_blank" rel="noreferrer"><strong>{job.company}</strong><span>{job.title}</span><small>{job.location} · {opportunityLabels[job.opportunityType||job.opportunity_type]}</small></a>)}</div>{unknown.length>0&&<><h3 className="mt-5">未定位 · {unknown.length}</h3><p className="muted">远程、海外或地点不明确的记录保留在列表中。</p><div className="map-job-list">{unknown.map(({job},index)=><a key={job.id||job.url||index} href={job.url} target="_blank" rel="noreferrer"><strong>{job.company}</strong><span>{job.title}</span><small>{job.location||'地点待确认'} · {opportunityLabels[job.opportunityType||job.opportunity_type]}</small></a>)}</div></>}</div></div>;
}
