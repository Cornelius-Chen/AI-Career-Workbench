import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const config=JSON.parse(await readFile((process.env.CAREER_LOCAL_DIRECTORY||'.local')+'/runtime.json','utf8'));
const [command,file]=process.argv.slice(2);
const actions={note:'agent.note',recommend:'recommendation.agent',task:'agent_task.create','task-update':'agent_task.update',profile:'profile.save',request:'agent.request'};
if(!['context','workspace','execute'].includes(command)&&!actions[command])throw Error('支持 context、workspace、execute、note、recommend、task、profile、request；写入内容通过 JSON 文件传入');
const response=await fetch(config.origin+(['workspace','execute'].includes(command)?'/api/workspace':'/api/team')+(command==='context'?'?view=agent':''),['context','workspace'].includes(command)?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...(command==='execute'?{}:{action:actions[command]}),...JSON.parse(await readFile(file,'utf8'))})});
const result=await response.json();if(!response.ok)throw Error(result.error);console.log(JSON.stringify(result,null,2));
