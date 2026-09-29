import {env} from 'cloudflare:workers';
import {sessionCookie} from '@/lib/github-auth';

export async function GET(request:Request){
 const url=new URL(request.url),target=url.searchParams.get('return_to')||'/';
 const returnTo=target.startsWith('/')&&!target.startsWith('//')?target:'/';
 if(!env.GITHUB_CLIENT_ID)return Response.redirect(new URL(`/signout-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`,url.origin),302);
 const response=new Response(null,{status:302,headers:{Location:new URL(returnTo,url.origin).toString()}});
 response.headers.append('Set-Cookie',`${sessionCookie}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
 return response;
}
