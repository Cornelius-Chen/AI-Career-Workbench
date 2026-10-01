import React from 'react';
import {AbsoluteFill, Composition, Img, Sequence, registerRoot, staticFile} from 'remotion';
import {CareerDemo} from './CareerDemo';

const highlights=[30,150,330,550,825,960,1110];
const Preview=()=> <AbsoluteFill>{highlights.map((source,index)=><Sequence key={source} from={index*60} durationInFrames={60}><Sequence from={-source}><CareerDemo/></Sequence></Sequence>)}</AbsoluteFill>;
const SocialCard=()=> <AbsoluteFill style={{background:'linear-gradient(120deg,#090c13,#16162e)',color:'#f5f6fb',fontFamily:'-apple-system, "PingFang SC", sans-serif',padding:65,overflow:'hidden'}}>
 <div style={{fontSize:19,letterSpacing:4,color:'#8ce4cb',marginBottom:32}}>AI CAREER WORKBENCH</div>
 <div style={{fontSize:65,fontWeight:700,lineHeight:1.25,letterSpacing:-2}}>让岗位研究<br/>接上下一步行动。</div>
 <div style={{fontSize:26,color:'#9ca6bb',marginTop:30}}>AI 求职工作台 · 默认单人，按需协作</div>
 <div style={{fontSize:22,color:'#a69bff',marginTop:26}}>本地运行 / 使用自己的 Agent / MIT 开源</div>
 <div style={{position:'absolute',left:795,top:85,width:660,height:450,borderRadius:16,overflow:'hidden',transform:'perspective(1600px) rotateY(-12deg) rotate(-6deg)',border:'1px solid #ffffff50',boxShadow:'0 20px 60px #0007'}}><Img src={staticFile('guide.jpg')} style={{width:'100%'}}/></div>
 <div style={{position:'absolute',left:65,bottom:54,fontSize:20,color:'#9ca6bb'}}>github.com/Cornelius-Chen/AI-Career-Workbench</div>
</AbsoluteFill>;
const Root=()=> <>
 <Composition id="CareerDemo" component={CareerDemo} durationInFrames={1200} fps={30} width={1920} height={1080}/>
 <Composition id="CareerPreview" component={Preview} durationInFrames={420} fps={30} width={1920} height={1080}/>
 <Composition id="SocialCard" component={SocialCard} durationInFrames={1} fps={30} width={1280} height={640}/>
</>;
registerRoot(Root);
