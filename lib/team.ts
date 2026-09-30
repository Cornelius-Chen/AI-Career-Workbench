import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db} from '@/lib/store';
import {OWNER_EMAIL,BROTHER_EMAIL,canonicalTeamEmail} from '@/lib/identities';
export {OWNER_EMAIL,BROTHER_EMAIL} from '@/lib/identities';

export async function teamUser(){
 const user=await getChatGPTUser();
 if(!user)throw Error('UNAUTHORIZED');
 const email=canonicalTeamEmail(user.email);
 if(email!==OWNER_EMAIL&&email!==BROTHER_EMAIL)throw Error('FORBIDDEN');
 const member=await db().prepare('SELECT * FROM team_members WHERE email=?').bind(email).first<any>();
 if(!member)throw Error('FORBIDDEN');
 if(member.user_id!==user.userId||member.name!==user.displayName)await db().prepare('UPDATE team_members SET user_id=?,name=? WHERE email=?').bind(user.userId,user.displayName,email).run();
 return {...member,email,name:user.displayName,user_id:user.userId};
}

export function teamError(error:any){
 const message=error.message||'操作失败';
 return Response.json({error:message},{status:message==='UNAUTHORIZED'?401:message==='FORBIDDEN'?403:400,headers:{'Cache-Control':'private, no-store'}});
}
