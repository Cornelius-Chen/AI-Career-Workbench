// Lever's public Postings API exposes published jobs, never application status.
export function leverPostingInfo(value:string){
 try{const u=new URL(value);const p=u.pathname.split('/').filter(Boolean);
  if(u.protocol!=='https:'||u.hostname!=='jobs.lever.co'||u.username||u.password||u.port||p.length<2||p.length>3||p.length===3&&p[2]!=='apply'||!/^[-\w]+$/.test(p[0])||!/^[-\da-f]{36}$/i.test(p[1]))return null;
  return{board:p[0],id:p[1]};
 }catch{return null}
}
function text(value:unknown){return typeof value==='string'?value:''}
function plain(value:unknown){return text(value).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/\s+/g,' ').trim()}
export function parseLeverPosting(data:any,expected:{board:string,id:string}){
 const link=leverPostingInfo(text(data?.applyUrl));
 if(data?.id!==expected.id||!text(data?.text).trim()||!link||link.board!==expected.board||link.id!==expected.id)throw Error('Lever 岗位编号或申请入口未能核实');
 const choose=(a:unknown,b:unknown)=>plain(a)||plain(b);
 const description=[choose(data.descriptionPlain,data.description),choose(data.descriptionBodyPlain,data.descriptionBody),...(Array.isArray(data.lists)?data.lists.flatMap((x:any)=>[x.text,x.content]):[]),choose(data.additionalPlain,data.additional)].map(plain).filter(Boolean).join('\n');
 if(!description)throw Error('Lever 岗位说明缺失');
 return{title:text(data.text),description,location:text(data.categories?.location),employment:text(data.categories?.commitment)};
}
