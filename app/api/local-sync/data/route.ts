import {env} from 'cloudflare:workers';
import {db,getFile,putFile} from '@/lib/store';
import schema from '@/lib/local-sync-schema.json';

export const dynamic='force-dynamic';
const keys=schema as Record<string,string>;
const canonical=(row:any)=>JSON.stringify(row===null?null:Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))));
function authorized(req:Request){return env.CAREER_LOCAL_MEMBER&&req.headers.get('authorization')===`Bearer ${env.CAREER_LOCAL_SYNC_TOKEN}`}
export async function GET(req:Request){
 if(!authorized(req))return new Response('FORBIDDEN',{status:403});
 const file=new URL(req.url).searchParams.get('file');
 if(file){const bytes=await getFile(file);return bytes?new Response(bytes,{headers:{'Content-Type':'application/octet-stream'}}):new Response('文件不存在',{status:404})}
 const entries=await Promise.all(Object.entries(keys).map(async([table,key])=>{
  const rows=await db().prepare(`SELECT * FROM "${table}"`).all<any>();
  return [table,Object.fromEntries(rows.results.map(row=>[row[key],row]))];
 }));
 return Response.json(Object.fromEntries(entries));
}
export async function POST(req:Request){
 if(!authorized(req))return new Response('FORBIDDEN',{status:403});
 const file=new URL(req.url).searchParams.get('file');
 if(file){await putFile(file,new Uint8Array(await req.arrayBuffer()));return Response.json({ok:true})}
 const {operations}=await req.json() as {operations:{table:string,key:string,expected:any,row:any}[]};
 const outcomes=[];
 for(let start=0;start<operations.length;start+=25){
  const part=operations.slice(start,start+25);
  const statements=part.map(operation=>{
   const {table,key,expected,row}=operation;
   if(!keys[table])throw Error('未知同步数据类型');
   const primary=keys[table];
   if(row===null){const columns=Object.keys(expected);return db().prepare(`DELETE FROM "${table}" WHERE "${primary}"=? AND ${columns.map(column=>`"${column}" IS ?`).join(' AND ')}`).bind(key,...columns.map(column=>expected[column]))}
   const columns=Object.keys(row);
   const insert=`INSERT INTO "${table}" (${columns.map(column=>`"${column}"`).join(',')}) VALUES (${columns.map(()=>'?').join(',')})`;
   if(expected===null)return db().prepare(insert+' ON CONFLICT DO NOTHING').bind(...columns.map(column=>row[column]));
   const previous=Object.keys(expected);
   return db().prepare(insert+` ON CONFLICT("${primary}") DO UPDATE SET ${columns.map(column=>`"${column}"=excluded."${column}"`).join(',')} WHERE ${previous.map(column=>`"${table}"."${column}" IS ?`).join(' AND ')}`).bind(...columns.map(column=>row[column]),...previous.map(column=>expected[column]));
  });
  const results=await db().batch(statements);
  for(let i=0;i<part.length;i++){
   const operation=part[i];
   const actual=results[i].meta.changes>0?operation.row:await db().prepare(`SELECT * FROM "${operation.table}" WHERE "${keys[operation.table]}"=?`).bind(operation.key).first<any>();
   outcomes.push({...operation,ok:results[i].meta.changes>0||canonical(actual)===canonical(operation.row),actual});
  }
 }
 return Response.json({outcomes});
}
