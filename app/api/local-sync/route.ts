import {env} from 'cloudflare:workers';

export const dynamic='force-dynamic';
async function relay(req:Request){
 if(!env.CAREER_LOCAL_MEMBER)return new Response('本地功能',{status:404});
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return new Response('FORBIDDEN',{status:403});
 const response=await fetch(env.CAREER_LOCAL_SYNC_URL!,{method:req.method,headers:{'Content-Type':'application/json','Authorization':`Bearer ${env.CAREER_LOCAL_SYNC_TOKEN}`},...(req.method==='POST'?{body:await req.text()}:{})});
 return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}
export const GET=relay;
export const POST=relay;
