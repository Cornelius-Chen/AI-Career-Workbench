import test from 'node:test';
import assert from 'node:assert/strict';
import {soloCredentials,normalizeCredentials,memberEnvironment} from '../scripts/local-config.mjs';
import {differences,sharedSnapshot} from '../scripts/local-sync.mjs';

test('a fresh solo installation has one blank identity, no shared repo, and no inherited career facts',()=>{
 const config=soloCredentials('Taylor');assert.equal(config.members.length,1);assert.equal(config.repo,undefined);assert.equal(config.members[0].name,'Taylor');
 const vars=memberEnvironment(config,config.ownerLogin,4318);assert.equal(vars.CAREER_LOCAL_MODE,'solo');assert.equal(vars.CAREER_SYNC_CONFIGURED,'');assert.equal(vars.CAREER_EMPTY_START,'1');assert.equal(vars.CAREER_LOCAL_EMAIL,config.emails.owner);
});
test('existing invitations migrate and a third member can be installed without account constants',()=>{
 const config=normalizeCredentials({repo:'private',emails:{owner:'a',brother:'b'},ids:{Alpha:'1',Beta:'2'}});config.members.push({login:'Gamma',name:'Gamma',id:'3',email:'c'});
 const vars=memberEnvironment(config,'Gamma',4328);assert.equal(vars.CAREER_LOCAL_EMAIL,'c');assert.equal(vars.CAREER_OWNER_EMAIL,'a');assert.equal(vars.CAREER_SYNC_CONFIGURED,'1');
 const state={team_members:{a:{email:'a',resume_shared:0},b:{email:'b',resume_shared:1},c:{email:'c',resume_shared:0}},files:{legacy:{}},team_files:{b:{member_email:'b'},c:{member_email:'c'}}};assert.deepEqual(Object.keys(sharedSnapshot(state,'Gamma',config.emails).team_files),['b']);
 const base={jobs:{},team_profiles:{}},changed={jobs:{job:{id:'job'}},team_profiles:{c:{member_email:'c'}}};assert.equal(differences(base,changed,'Alpha','Alpha').length,2);assert.equal(differences(base,changed,'Gamma','Alpha').length,1);
});
