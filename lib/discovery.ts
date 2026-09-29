export function isDiscoveryTitle(title:string){
 return /\b(?:AI|ML|LLM|NLP|machine learning|software|forward deployed|data scien\w*|applied scien\w*|agent|product engineer\w*)\b/i.test(title)
  && !/\b(?:senior|sr\.?|staff|principal|director|intern|internship|manager)\b/i.test(title);
}

// Some Greenhouse boards return employer-site aliases as absolute_url. Resolve
// their numeric requisitions to the same ATS URL used by existing applications,
// so discovery neither widens fetch permissions nor duplicates those records.
export function greenhouseDiscoveryJobs(board:string,jobs:any[]){
 if(!/^[\w-]+$/.test(board))throw Error('Greenhouse 来源名称无效');
 return jobs.map(job=>{
  const id=typeof job.id==='number'&&Number.isSafeInteger(job.id)?String(job.id):job.id;
  if(typeof id!=='string'||! /^[1-9]\d*$/.test(id))throw Error('Greenhouse 岗位编号无效');
  return {...job,jobUrl:undefined,absolute_url:`https://job-boards.greenhouse.io/${board}/jobs/${id}`};
 });
}

export function knownDiscoveryKeys(urls:string[],key:(url:string)=>string,boardInfo:(url:string)=>{type:string;board?:string;id?:string}|null){
 const known=new Set<string>();
 for(const url of urls){
  known.add(key(url));
  const b=boardInfo(url);
  if(b?.type==='greenhouse'&&b.board&&/^[\w-]+$/.test(b.board)&&b.id&&/^[1-9]\d*$/.test(b.id)){
   known.add(key(`https://job-boards.greenhouse.io/${b.board}/jobs/${b.id}`));
  }
 }
 return known;
}

export function selectDiscoveryBatch(jobs:any[],known:Set<string>,key:(url:string)=>string,limit=25){
 const selected:any[]=[];const seen=new Set(known);let pending=false;
 for(const job of jobs){
  if(job.isListed===false||!isDiscoveryTitle(job.title||''))continue;
  const url=job.jobUrl||job.absolute_url;if(!url)continue;
  const id=key(url);if(seen.has(id))continue;seen.add(id);
  if(selected.length===limit){pending=true;break;}selected.push(job);
 }
 return {selected,pending};
}

// Cap the actual streamed body, not just the optional Content-Length header.
export async function readBoardJson(response:Response,maxBytes=8*1024*1024){
 if(!response.body)throw Error('招聘列表为空');
 const reader=response.body.getReader();const decoder=new TextDecoder();const parts:string[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;
  if(size>maxBytes){await reader.cancel();throw Error('招聘列表过大，需单独核验该来源');}
  parts.push(decoder.decode(value,{stream:true}));
 }parts.push(decoder.decode());return JSON.parse(parts.join(''));}finally{reader.releaseLock();}
}
