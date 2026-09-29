import {owner} from '@/lib/store';
import Workspace from './workspace';
import { requireChatGPTUser } from './chatgpt-auth';
import {redirect} from 'next/navigation';
import {BROTHER_EMAIL,canonicalTeamEmail} from '@/lib/identities';
export const dynamic = 'force-dynamic';
export default async function Home(){const user=await requireChatGPTUser('/');if(canonicalTeamEmail(user.email)===BROTHER_EMAIL)redirect('/team');await owner();return <Workspace/>;}
