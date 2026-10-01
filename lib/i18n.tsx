'use client';
import {useEffect,useSyncExternalStore} from 'react';
import {formatMessage,type Language} from './i18n-messages';
const storageKey='career-workbench-language';
let language:Language='en';
let initialized=false;
const listeners=new Set<()=>void>();
const subscribe=(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener)}};
export const dateLocale=()=>language==='en'?'en-US':'zh-CN';
export function t(message:string,...values:unknown[]){return formatMessage(message,language,...values)}
export function setLanguage(next:Language){
 language=next;
 localStorage.setItem(storageKey,next);
 document.documentElement.lang=next==='en'?'en':'zh-CN';
 document.title=next==='en'?'AI Career Workbench':'AI 求职工作台';
 for(const listener of listeners)listener();
}
export function useLanguage(){
 const current=useSyncExternalStore(subscribe,()=>language,()=>'en' as Language);
 useEffect(()=>{
  if(!initialized){initialized=true;setLanguage(localStorage.getItem(storageKey)==='zh'?'zh':'en')}
 },[]);
 return current;
}
export function LanguageSwitch(){
 const current=useLanguage();
 return <label className="language-switch"><span className="sr-only">{t('界面语言')}</span><select aria-label={t('界面语言')} value={current} onChange={event=>setLanguage(event.target.value as Language)}><option value="en">English</option><option value="zh">中文</option></select></label>;
}
