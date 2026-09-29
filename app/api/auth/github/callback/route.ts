import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {githubSession,sessionCookie} from '@/lib/github-auth';

export async function GET(request:Request){
 const url=new URL(request.url),jar=await cookies();
 const code=url.searchParams.get('code'),state=url.searchParams.get('state');
 if(!code||!state||state!==jar.get('career_oauth_state')?.value)return new Response('GitHub 登录校验失败',{status:400});
 const verifier=jar.get('career_oauth_verifier')?.value;
 if(!verifier)return new Response('GitHub 登录已过期',{status:400});
 const tokenResponse=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GITHUB_CLIENT_ID!,client_secret:env.GITHUB_CLIENT_SECRET!,code,redirect_uri:`${url.origin}/api/auth/github/callback`,code_verifier:verifier})});
 const token=await tokenResponse.json() as {access_token?:string};
 if(!token.access_token)return new Response('GitHub 登录失败',{status:401});
 const userResponse=await fetch('https://api.github.com/user',{headers:{Authorization:`Bearer ${token.access_token}`,Accept:'application/vnd.github+json','User-Agent':'ai-career-workbench'}});
 const user=await userResponse.json() as {id:number,login:string};
 if(![env.GITHUB_OWNER_ID,env.GITHUB_BROTHER_ID].includes(String(user.id)))return new Response('这个 GitHub 账号尚未获得访问权限',{status:403});
 const encodedReturn=jar.get('career_oauth_return')?.value||'';
 const returnTo=encodedReturn?new TextDecoder().decode(Uint8Array.from(atob(encodedReturn.replace(/-/g,'+').replace(/_/g,'/')),character=>character.charCodeAt(0))):'/team';
 const response=Response.redirect(new URL(returnTo,url.origin),302);
 response.headers.append('Set-Cookie',`${sessionCookie}=${await githubSession(user.id,user.login)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);
 for(const name of ['career_oauth_state','career_oauth_verifier','career_oauth_return'])response.headers.append('Set-Cookie',`${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
 return response;
}
