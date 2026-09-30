import {copyFileSync} from 'node:fs';

copyFileSync('dist/server/prerendered-routes/team.html','dist/client/team.html');
