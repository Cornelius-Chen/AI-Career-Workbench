import {env} from 'cloudflare:workers';

async function key(){
 const bytes=new Uint8Array(env.TEAM_FILE_KEY!.match(/../g)!.map(part=>parseInt(part,16)));
 return crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['encrypt','decrypt']);
}

export async function encryptTeamFile(bytes:Uint8Array){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const input=new Uint8Array(bytes.length);input.set(bytes);
 const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),input));
 const result=new Uint8Array(iv.length+encrypted.length);
 result.set(iv);result.set(encrypted,iv.length);
 return result;
}

export async function decryptTeamFile(bytes:Uint8Array){
 const iv=bytes.slice(0,12);
 const input=new Uint8Array(bytes.length-12);input.set(bytes.slice(12));
 return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv},await key(),input));
}
