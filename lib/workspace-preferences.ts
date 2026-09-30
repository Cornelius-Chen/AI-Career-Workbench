import {env} from 'cloudflare:workers';
import {getSetting} from './store';

export async function workspacePreferences(){
 return getSetting('workspace.preferences',{mode:env.CAREER_LOCAL_MODE||'solo'});
}
