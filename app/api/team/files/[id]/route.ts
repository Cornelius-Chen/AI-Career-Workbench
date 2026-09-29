import {getFile,db} from '@/lib/store';
import {decryptTeamFile} from '@/lib/team-crypto';
import {OWNER_EMAIL,teamError,teamUser} from '@/lib/team';

export const dynamic='force-dynamic';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const me=await teamUser();
  const {id}=await params;
  const teamFile=await db().prepare('SELECT * FROM team_files WHERE id=?').bind(id).first<any>();
  const file=teamFile||await db().prepare('SELECT * FROM files WHERE id=?').bind(id).first<any>();
  if(!file)return new Response('文件不存在',{status:404});
  const ownerEmail=teamFile?teamFile.member_email:OWNER_EMAIL;
  if(ownerEmail!==me.email){
   const member=await db().prepare('SELECT resume_shared FROM team_members WHERE email=?').bind(ownerEmail).first<any>();
   if(!member?.resume_shared)throw Error('FORBIDDEN');
  }
  const object=await getFile(teamFile?'team/'+id:id);
  if(!object)return new Response('文件不存在',{status:404});
  const bytes=teamFile?await decryptTeamFile(new Uint8Array(object)):new Uint8Array(object);
  return new Response(bytes,{headers:{'Content-Type':file.type,'Content-Disposition':`attachment; filename="${file.name.replace(/[^a-zA-Z0-9_.-]/g,'_')}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return teamError(e)}
}
