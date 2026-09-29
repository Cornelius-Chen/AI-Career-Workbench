import {env} from 'cloudflare:workers';

const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function GET(request:Request){
 const url=new URL(request.url);
 const target=url.searchParams.get('return_to')||'/team';
 const returnTo=target.startsWith('/')&&!target.startsWith('//')?target:'/team';
 const state=encode(crypto.getRandomValues(new Uint8Array(32)));
 const verifier=encode(crypto.getRandomValues(new Uint8Array(32)));
 const challenge=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 const authorize=new URL('https://github.com/login/oauth/authorize');
 authorize.searchParams.set('client_id',env.GITHUB_CLIENT_ID!);
 authorize.searchParams.set('redirect_uri',`${url.origin}/api/auth/github/callback`);
 authorize.searchParams.set('state',state);
 authorize.searchParams.set('code_challenge',challenge);
 authorize.searchParams.set('code_challenge_method','S256');
 const response=new Response(null,{status:302,headers:{Location:authorize.toString()}});
 response.headers.append('Set-Cookie',`career_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
 response.headers.append('Set-Cookie',`career_oauth_verifier=${verifier}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
 response.headers.append('Set-Cookie',`career_oauth_return=${encode(new TextEncoder().encode(returnTo))}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
 return response;
}
