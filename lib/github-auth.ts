import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {OWNER_EMAIL,BROTHER_EMAIL} from '@/lib/identities';

export const sessionCookie='career_github_session';
const textEncoder=new TextEncoder();
const base64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const fromBase64url=(value:string)=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),character=>character.charCodeAt(0));
const key=()=>crypto.subtle.importKey('raw',textEncoder.encode(env.GITHUB_SESSION_SECRET!),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);

export async function githubSession(id:number,login:string){
 const body=base64url(textEncoder.encode(JSON.stringify({id,login,exp:Date.now()+7*24*60*60*1000})));
 const signature=base64url(new Uint8Array(await crypto.subtle.sign('HMAC',await key(),textEncoder.encode(body))));
 return `${body}.${signature}`;
}

export async function githubUser(){
 const value=(await cookies()).get(sessionCookie)?.value;
 if(!value)return null;
 const [body,signature]=value.split('.');
 if(!body||!signature)return null;
 const valid=await crypto.subtle.verify('HMAC',await key(),fromBase64url(signature),textEncoder.encode(body));
 if(!valid)return null;
 const payload=JSON.parse(new TextDecoder().decode(fromBase64url(body))) as {id:number,login:string,exp:number};
 if(payload.exp<Date.now())return null;
 const email=String(payload.id)===env.GITHUB_OWNER_ID?OWNER_EMAIL:String(payload.id)===env.GITHUB_BROTHER_ID?BROTHER_EMAIL:null;
 if(!email)return null;
 return {userId:`github:${payload.id}`,displayName:payload.login,email,fullName:null};
}
