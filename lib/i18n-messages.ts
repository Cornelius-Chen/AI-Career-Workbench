import english from './locales/en.json' with {type:'json'};
export type Language='en'|'zh';
const messages:Record<string,string>=english;

export function formatMessage(message:string,locale:Language,...values:unknown[]){
 const copy=locale==='en'?(messages[message]??message):message;
 return values.length===0?copy:copy.replace(/\{(\d+)\}/g,(_,index)=>String(values[Number(index)]));
}
