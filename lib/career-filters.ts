export const careerLanes=['全部类型','AI / Agent','机器学习','数据科学','FDE / 客户交付','软件工程','其他'] as const;
export const careerRegions=['全部地区','湾区','纽约','西雅图','波士顿','洛杉矶','美国其他地区','远程 / 全美','海外','地点待确认'] as const;

export function careerLane(value:{lane?:string;title?:string}){
 const title=(value.title||'').toLowerCase();
 const text=title||value.lane?.toLowerCase()||'';
 if(/forward deployed|\bfde\b|customer engineer|solutions engineer|field engineer/.test(text))return 'FDE / 客户交付';
 if(/data scien|analytic|statistic|business intelligence/.test(text))return '数据科学';
 if(/machine learning|\bml\b|deep learning/.test(text))return '机器学习';
 if(/\bai\b|agent|llm|rag|generative/.test(text))return 'AI / Agent';
 if(/data engineer/.test(text))return '数据科学';
 if(/engineer|developer|software|platform/.test(text))return '软件工程';
 return value.lane&&/\bai\b|agent|llm|rag/.test(value.lane.toLowerCase())?'AI / Agent':'其他';
}

export function careerRegion(location:string){
 const text=location.toLowerCase();
 if(!text.trim())return '地点待确认';
 if(/san francisco|bay area|san jose|san mateo|sunnyvale|santa clara|mountain view|menlo park|palo alto|redwood city|foster city|cupertino|livermore|milpitas|\bsf\b/.test(text))return '湾区';
 if(/new york|\bnyc\b|brooklyn|manhattan|stamford|greenwich|norwalk/.test(text))return '纽约';
 if(/seattle|redmond|bellevue/.test(text))return '西雅图';
 if(/boston|cambridge|framingham|north reading/.test(text))return '波士顿';
 if(/los angeles|santa monica|long beach|costa mesa|universal city/.test(text))return '洛杉矶';
 if(/remote|united states|\busa\b|nationwide|anywhere in the us/.test(text))return '远程 / 全美';
 if(/singapore|india|london|united kingdom|canada|europe|china|hong kong/.test(text))return '海外';
 return '美国其他地区';
}
