import {randomBytes,randomUUID} from 'node:crypto';

export function normalizeCredentials(value){
 if(value.members)return value;
 const logins=Object.keys(value.ids);
 return {...value,ownerLogin:logins[0],members:logins.map((login,index)=>({login,name:login,id:value.ids[login],email:index===0?value.emails.owner:value.emails.brother})),mode:'collaboration'};
}
export function soloCredentials(name){
 const id=randomUUID(),login='local-'+id,email=id+'@local.invalid';
 return {ownerLogin:login,emails:{owner:email},fileKey:randomBytes(32).toString('hex'),mode:'solo',members:[{login,name,id,email}]};
}
export function memberEnvironment(credentials,login,syncPort){
 const member=credentials.members.find(person=>person.login===login);
 return {CAREER_LOCAL_MEMBER:member.name,CAREER_LOCAL_EMAIL:member.email,CAREER_LOCAL_USER_ID:'local:'+member.id,CAREER_OWNER_EMAIL:credentials.emails.owner,CAREER_LOCAL_MODE:credentials.mode,CAREER_SYNC_CONFIGURED:credentials.repo?'1':'',CAREER_EMPTY_START:'1',CAREER_LOCAL_SYNC_URL:`http://127.0.0.1:${syncPort}`};
}
