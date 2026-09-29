import {owner} from '@/lib/store';
import Workspace from './workspace';
import { requireChatGPTUser } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Home(){await requireChatGPTUser('/');await owner();return <Workspace/>;}
