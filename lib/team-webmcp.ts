export function registerTeamTools(api:(action:string,payload:any)=>Promise<any>,reload:()=>Promise<any>){
 const context=(document as any).modelContext;
 if(!context?.registerTool)return()=>{};
 const abort=new AbortController();
 const tools=[
  {name:'read_shared_career_space',description:'Read the two-person career board: shared messages, agent tasks, recommendations and application progress. Personal resume files are shown only when shared by their owner.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:async()=>reload()},
  {name:'post_shared_career_message',description:'Post a message in the shared room, attributed to the currently signed-in account and marked as an agent message.',inputSchema:{type:'object',properties:{content:{type:'string'}},required:['content'],additionalProperties:false},execute:async(x:any)=>{const result=await api('message.post',{content:x.content,authorKind:'agent'});await reload();return result}},
  {name:'create_shared_career_task',description:'Create a task visible to both people and agents.',inputSchema:{type:'object',properties:{title:{type:'string'},details:{type:'string'},assignedToEmail:{type:'string'}},required:['title'],additionalProperties:false},execute:async(x:any)=>{const result=await api('agent_task.create',x);await reload();return result}},
  {name:'update_shared_career_task',description:'Update a shared task status to open, doing or done.',inputSchema:{type:'object',properties:{id:{type:'string'},status:{type:'string',enum:['open','doing','done']}},required:['id','status'],additionalProperties:false},execute:async(x:any)=>{const result=await api('agent_task.update',x);await reload();return result}},
  {name:'recommend_shared_job',description:'Recommend an existing job by ID, or provide company, title, HTTPS URL, location and job type. Both people can see it.',inputSchema:{type:'object',properties:{jobId:{type:'string'},company:{type:'string'},title:{type:'string'},url:{type:'string'},location:{type:'string'},lane:{type:'string'},note:{type:'string'}},additionalProperties:false},execute:async(x:any)=>{const result=await api('recommendation.add',x);await reload();return result}}
 ];
 for(const tool of tools)Promise.resolve(context.registerTool(tool,{signal:abort.signal}));
 return()=>abort.abort();
}
