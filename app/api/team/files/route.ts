import {putFile,db} from '@/lib/store';
import {encryptTeamFile} from '@/lib/team-crypto';
import {teamError,teamUser} from '@/lib/team';

export async function POST(req:Request){
 try{
  const me=await teamUser();
  const origin=req.headers.get('origin');
  if(origin&&origin!==new URL(req.url).origin)throw Error('FORBIDDEN');
  const form=await req.formData();
  const file=form.get('file');
  if(!(file instanceof File)||file.size===0||file.size>10*1024*1024)throw Error('请上传 10MB 以内的 PDF 或 DOCX');
  const extension=file.name.toLowerCase().split('.').pop();
  if(extension!=='pdf'&&extension!=='docx')throw Error('只接受 PDF 或 DOCX');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(extension==='pdf'&&new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('文件格式与扩展名不一致');
  if(extension==='docx'&&(bytes[0]!==80||bytes[1]!==75))throw Error('文件格式与扩展名不一致');
  const id=crypto.randomUUID();
  const type=extension==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  await putFile('team/'+id,await encryptTeamFile(bytes));
  await db().prepare('INSERT INTO team_files(id,member_email,name,type,size,created) VALUES(?,?,?,?,?,?)').bind(id,me.email,file.name,type,file.size,new Date().toISOString()).run();
  return Response.json({id,name:file.name},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return teamError(e)}
}
