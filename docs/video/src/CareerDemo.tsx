import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

const ink='#f5f6fb', muted='#9ca6bb', violet='#a69bff', mint='#8ce4cb';
const font='Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const ramp=(frame:number,from:number,to:number)=>interpolate(frame,[from,to],[0,1],clamp);
const scenes=[['01','个人目标'],['02','Agent 研究'],['03','本人选择'],['04','申请跟进'],['05','可选协作']];

function Background(){
 const frame=useCurrentFrame();
 return <AbsoluteFill style={{background:'#090c13',overflow:'hidden'}}>
  <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(#ffffff05 1px, transparent 1px),linear-gradient(90deg,#ffffff05 1px,transparent 1px)',backgroundSize:'80px 80px',maskImage:'linear-gradient(transparent, black 50%, transparent)'}}/>
  <div style={{position:'absolute',width:1000,height:1000,left:1050,top:-540,borderRadius:'50%',background:'radial-gradient(circle,#6c56d330,transparent 68%)',transform:`translate(${Math.sin(frame/150)*55}px,${Math.cos(frame/180)*40}px)`}}/>
  <div style={{position:'absolute',width:1100,height:1100,left:-550,top:520,borderRadius:'50%',background:'radial-gradient(circle,#2c9c8924,transparent 65%)'}}/>
 </AbsoluteFill>;
}
function Enter({children,delay=0,style={}}:{children:React.ReactNode;delay?:number;style?:React.CSSProperties}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();
 const p=spring({frame:frame-delay,fps,config:{damping:22,stiffness:100}});
 return <div style={{...style,opacity:ramp(frame,delay,delay+16),transform:`translateY(${(1-p)*36}px)`}}>{children}</div>;
}
function Scene({children,duration}:{children:React.ReactNode;duration:number}){
 const frame=useCurrentFrame();
 const alpha=Math.min(ramp(frame,0,15),1-ramp(frame,duration-14,duration));
 return <AbsoluteFill style={{opacity:alpha}}>{children}</AbsoluteFill>;
}
function Chip({children,color=mint}:{children:React.ReactNode;color?:string}){
 return <span style={{display:'inline-flex',alignItems:'center',gap:10,border:'1px solid #ffffff20',background:'#121823',padding:'13px 22px',borderRadius:50,fontSize:25,color}}><span style={{width:7,height:7,borderRadius:8,background:color}}/>{children}</span>;
}
function BrowserPanel({file,width=1200,height=650,pan=0,start=0,tilt=0}:{file:string;width?:number;height?:number;pan?:number;start?:number;tilt?:number}){
 const frame=useCurrentFrame();
 const move=start+interpolate(frame,[35,180],[0,pan],clamp);
 return <div style={{width,height,borderRadius:22,border:'1px solid #ffffff35',overflow:'hidden',background:'#f3f5fa',boxShadow:'0 42px 100px #0008',transform:`perspective(2400px) rotateY(${tilt}deg)`,flexShrink:0}}>
  <div style={{height:45,background:'#1d2432',display:'flex',alignItems:'center',padding:'0 20px',gap:9}}>
   {['#fb7185','#fbbf24','#8ce4cb'].map(color=><span key={color} style={{width:10,height:10,borderRadius:10,background:color,opacity:.8}}/>)}
   <span style={{fontSize:16,color:'#b5bfd0',marginLeft:25}}>AI Career Workbench · 本地演示</span>
  </div>
  <div style={{height:height-45,overflow:'hidden'}}><Img src={staticFile(file)} style={{display:'block',width:'100%',transform:`translateY(${-move}px)`}}/></div>
 </div>;
}
function TextBlock({step,title,subtitle,body,children}:{step:string;title:string;subtitle:string;body:string;children?:React.ReactNode}){
 return <div style={{position:'absolute',left:100,top:205,width:470}}>
  <Enter><div style={{fontSize:24,letterSpacing:4,color:violet,marginBottom:28}}>{step}</div></Enter>
  <Enter delay={7}><h1 style={{fontSize:69,lineHeight:1.22,letterSpacing:-2,margin:'0 0 24px',whiteSpace:'pre-line'}}>{title}</h1></Enter>
  <Enter delay={14}><div style={{fontSize:25,color:mint,marginBottom:34}}>{subtitle}</div></Enter>
  <Enter delay={21}><p style={{fontSize:29,lineHeight:1.65,color:muted,margin:'0 0 35px'}}>{body}</p></Enter>
  <Enter delay={28}>{children}</Enter>
 </div>;
}
function Progress({active}:{active:number}){
 const frame=useCurrentFrame();
 return <div style={{position:'absolute',left:100,right:100,bottom:80,display:'flex',gap:18}}>{scenes.map(([number,label],i)=><div key={number} style={{flex:1,opacity:i>active ? .3 : 1}}>
  <div style={{height:2,background:'#ffffff15',marginBottom:15}}><div style={{height:2,width:i<active?'100%':i===active?`${ramp(frame,0,170)*100}%`:'0%',background:i===active?violet:mint}}/></div>
  <span style={{fontSize:20,color:i===active?ink:muted}}>{number} / {label}</span>
 </div>)}</div>;
}
function Intro(){
 const frame=useCurrentFrame();
 return <Scene duration={120}>
  <div style={{position:'absolute',left:105,top:190,zIndex:2}}>
   <Enter><div style={{fontSize:24,letterSpacing:5,color:mint,marginBottom:35}}>AI CAREER WORKBENCH</div></Enter>
   <Enter delay={9}><h1 style={{fontSize:94,lineHeight:1.2,letterSpacing:-4,margin:0}}>让岗位研究<br/>接上下一步行动<span style={{color:violet}}>。</span></h1></Enter>
   <Enter delay={19}><p style={{fontSize:32,color:muted,marginTop:38}}>你的目标 · 你的 Agent · 持续推进的申请</p></Enter>
   <Enter delay={27}><div style={{display:'flex',gap:14,marginTop:40}}><Chip>默认单人</Chip><Chip color={violet}>按需协作</Chip></div></Enter>
  </div>
  <div style={{position:'absolute',left:930,top:165,transform:`rotate(-7deg) translateY(${interpolate(frame,[0,120],[38,-16])}px)`,opacity:ramp(frame,15,35)}}><BrowserPanel file="guide.jpg" width={980} height={690} tilt={-10}/></div>
  <div style={{position:'absolute',left:1060,top:760,padding:'24px 34px',borderRadius:20,background:'#1a2330',border:'1px solid #8ce4cb45',fontSize:28,opacity:ramp(frame,35,55),boxShadow:'0 15px 40px #0008'}}>资料 → 研究 → 选择 → 申请 → 复盘</div>
 </Scene>;
}
function Goals(){return <Scene duration={180}>
 <TextBlock step="01 / KNOW YOUR GOAL" title={'先说清楚\n你想去哪里'} subtitle="Full-time or summer internship" body="方向、地区、技能与年份，成为 Agent 判断匹配的起点。"><Chip>上传简历后，确认真实资料</Chip></TextBlock>
 <Enter delay={12} style={{position:'absolute',left:655,top:190}}><BrowserPanel file="goals.jpg" width={1165} height={585}/></Enter>
 <div style={{position:'absolute',left:720,top:805,fontSize:27,color:muted}}>目标由本人填写；联系方式与身份答案单独核实。</div><Progress active={0}/>
 </Scene>}
function Research(){return <Scene duration={210}>
 <TextBlock step="02 / RESEARCH WITH YOUR AGENT" title={'让研究\n留下依据'} subtitle="Finding → Evidence → Next action" body="自己的 Agent 读取资料、核实招聘官网，并保留发现、来源和下一步。"><Chip>复制引导指令给自己的 Agent</Chip></TextBlock>
 <Enter delay={10} style={{position:'absolute',left:655,top:175}}><BrowserPanel file="agent.jpg" width={1165} height={650} pan={35}/></Enter>
 <div style={{position:'absolute',left:720,top:850,fontSize:27,color:muted}}>网页保存要求；实际研究由你的 Agent 执行。</div><Progress active={1}/>
 </Scene>}
function Choose(){
 const frame=useCurrentFrame();
 return <Scene duration={180}>
  <TextBlock step="03 / YOU MAKE THE CHOICE" title={'看懂推荐\n再做选择'} subtitle="Accept a plan. Or skip it." body="查看岗位类型、时间和推荐理由。适合自己，就加入申请计划。"><Chip>加入计划后继续准备申请</Chip></TextBlock>
  <Enter delay={10} style={{position:'absolute',left:655,top:170}}><BrowserPanel file="recommendations.jpg" width={1165} height={650} pan={60}/></Enter>
  <div style={{position:'absolute',left:750,top:695,opacity:ramp(frame,60,80),transform:`scale(${1+ramp(frame,65,85)*.025})`,padding:'20px 32px',borderRadius:15,background:'#6159df',fontSize:30,boxShadow:'0 10px 40px #6159df66'}}>＋ 加入我的申请</div>
  <div style={{position:'absolute',left:720,top:850,fontSize:27,color:muted}}>计划投递 ≠ 已投递；提交成功需要真实凭证。</div><Progress active={2}/>
 </Scene>;
}
function Track(){
 const frame=useCurrentFrame();
 const mapVisible=frame>=108;
 return <Scene duration={210}>
  <TextBlock step="04 / TRACK THE NEXT STEP" title={mapVisible?'机会在哪\n一眼看清':'申请多了\n也能找到重点'} subtitle={mapVisible?'Locations. Job types. Your plans.':'Filter by stage, role and region.'} body={mapVisible?'推荐与已投递岗位可切换；不同岗位类型，用不同颜色呈现。':'按进度、岗位类型和地区筛选，接着处理对应材料、测评与面试。'}><Chip>{mapVisible?'无法定位的岗位仍在列表':'每条申请保留进度与依据'}</Chip></TextBlock>
  <div style={{position:'absolute',left:655,top:170,opacity:mapVisible?ramp(frame,108,120):1-ramp(frame,96,108)}}><BrowserPanel file={mapVisible?'map.jpg':'workbench.jpg'} width={1165} height={650} start={mapVisible?80:390} pan={mapVisible?15:120}/></div>
  <div style={{position:'absolute',left:720,top:850,fontSize:27,color:muted}}>用真实反馈，调整下一轮研究与申请优先级。</div><Progress active={3}/>
 </Scene>;
}
function Collaborate(){
 const frame=useCurrentFrame();
 return <Scene duration={180}>
  <TextBlock step="05 / OPTIONAL COLLABORATION" title={'各自求职\n一起积累线索'} subtitle="Solo by default. Collaborate when ready." body="两人或多人各自维护目标。开启协作后，交换岗位、进度与 Agent 的有效发现。"><Chip>全职与暑期实习分别推荐</Chip></TextBlock>
  <Enter delay={8} style={{position:'absolute',left:655,top:160}}><BrowserPanel file="collaboration.jpg" width={1165} height={510} pan={150}/></Enter>
  <Enter delay={30} style={{position:'absolute',left:655,top:705,width:1165,display:'flex',alignItems:'center',gap:20}}>
   {['本机保存','手动加密上传 / 拉取','伙伴的本机'].map((label,i)=><React.Fragment key={label}>{i>0&&<span style={{color:mint,fontSize:38,opacity:.5+Math.sin(frame/16)*.2}}>↔</span>}<div style={{flex:i===1?1.6:1,border:'1px solid #ffffff25',borderRadius:18,padding:'25px 15px',textAlign:'center',fontSize:27,background:i===1?'#152b29':'#141b26',color:i===1?mint:ink}}>{label}</div></React.Fragment>)}
  </Enter>
  <div style={{position:'absolute',left:720,top:845,fontSize:26,color:muted}}>设置私有数据仓库后可同步；简历共享由本人选择。</div><Progress active={4}/>
 </Scene>;
}
function Outro(){return <Scene duration={120}>
 <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
  <Enter><div style={{fontSize:24,letterSpacing:5,color:mint,marginBottom:30}}>START WITH YOUR OWN GOAL</div></Enter>
  <Enter delay={7}><h1 style={{fontSize:83,margin:0,letterSpacing:-3}}>AI Career Workbench</h1></Enter>
  <Enter delay={14}><div style={{fontSize:40,color:muted,marginTop:25}}>AI 求职工作台 · 默认单人，按需协作</div></Enter>
  <Enter delay={21}><div style={{display:'flex',gap:18,margin:'40px 0'}}><Chip>Mac 本地运行</Chip><Chip>使用自己的 Agent</Chip><Chip color={violet}>MIT 开源</Chip></div></Enter>
  <Enter delay={28}><div style={{fontSize:31,padding:'25px 38px',border:'1px solid #ffffff30',background:'#171c2a',borderRadius:18}}>github.com/Cornelius-Chen/AI-Career-Workbench</div></Enter>
  <Enter delay={35}><p style={{fontSize:28,color:muted,marginTop:32}}>打开 README，复制安装指令给自己的 Agent。</p></Enter>
 </div>
 </Scene>}
export function CareerDemo(){
 const frame=useCurrentFrame();
 return <AbsoluteFill style={{color:ink,fontFamily:font}}>
  <Background/>
  <Audio src={staticFile('score.wav')} volume={.65}/>
  <Sequence from={0} durationInFrames={120}><Intro/></Sequence>
  <Sequence from={120} durationInFrames={180}><Goals/></Sequence>
  <Sequence from={300} durationInFrames={210}><Research/></Sequence>
  <Sequence from={510} durationInFrames={180}><Choose/></Sequence>
  <Sequence from={690} durationInFrames={210}><Track/></Sequence>
  <Sequence from={900} durationInFrames={180}><Collaborate/></Sequence>
  <Sequence from={1080} durationInFrames={120}><Outro/></Sequence>
  <div style={{position:'absolute',left:100,right:100,top:48,display:'flex',justifyContent:'space-between',fontSize:20,color:muted,letterSpacing:1}}><span>AI CAREER WORKBENCH</span><span>真实界面 · 虚构演示数据</span></div>
  <div style={{position:'absolute',left:0,bottom:0,height:3,width:`${(frame+1)/12}%`,background:'linear-gradient(90deg,#8ce4cb,#a69bff)'}}/>
 </AbsoluteFill>;
}
