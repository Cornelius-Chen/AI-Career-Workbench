import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {teamUser} from '@/lib/team';
import TeamBoard from './team-board';

export const dynamic='force-dynamic';
export default async function TeamPage(){
 await requireChatGPTUser('/team');
 await teamUser();
 return <TeamBoard/>;
}
