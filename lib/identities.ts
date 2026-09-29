import {env} from 'cloudflare:workers';

export const OWNER_EMAIL=env.CAREER_OWNER_EMAIL;
export const BROTHER_EMAIL=env.CAREER_BROTHER_EMAIL;

export function canonicalTeamEmail(email:string){
 return email.toLowerCase();
}

export function isOwnerEmail(email:string){
 return canonicalTeamEmail(email)===OWNER_EMAIL;
}
