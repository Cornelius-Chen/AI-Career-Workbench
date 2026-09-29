import test from 'node:test';
import assert from 'node:assert/strict';
import {structuredBoardInfo,hasEmployerApplicationLink} from '../lib/official-sources.ts';

test('official HRT job and its embedded form resolve to the same requisition',()=>{
 const expected={type:'greenhouse',board:'wehrtyou',id:'8052050'};
 assert.deepEqual(structuredBoardInfo('https://www.hudsonrivertrading.com/careers/job/?gh_jid=8052050'),expected);
 assert.deepEqual(structuredBoardInfo('https://job-boards.greenhouse.io/embed/job_app?for=wehrtyou&token=8052050'),expected);
 for(const url of ['https://www.hudsonrivertrading.com.evil.test/careers/job/?gh_jid=8052050','https://www.hudsonrivertrading.com/careers/job/?gh_jid=invalid','https://job-boards.greenhouse.io/embed/job_app?for=wehrtyou','https://job-boards.greenhouse.io/embed/job_app?for=../private&token=8052050'])assert.equal(structuredBoardInfo(url),null);
});
test('Google requires a job detail page and one role-specific official Apply anchor',()=>{
 const url='https://www.google.com/about/careers/applications/jobs/results/78703249065943750-software-engineer-early-career-campus';
 const link='<a href="./apply?jobId=opaque-role-id&amp;loc=US">Apply</a>';
 assert.equal(hasEmployerApplicationLink(url,link),true);
 for(const html of ['<a href="./apply">Apply</a>','<a href="./apply?jobId=">Apply</a>','<a href="https://evil.test/apply?jobId=x">Apply</a>',link+link])assert.equal(hasEmployerApplicationLink(url,html),false);
 assert.equal(hasEmployerApplicationLink(url.replace('www.google.com','www.google.com.evil.test'),link),false);
 assert.equal(hasEmployerApplicationLink('https://www.google.com/about/careers/applications/jobs/results/',link),false);
});
test('an unrelated Jane Street application link is not an active-job signal',()=>{
 const url='https://www.janestreet.com/join-jane-street/position/8573726002/';
 assert.equal(hasEmployerApplicationLink(url,'<a href="/join-jane-street/apply/8573726002/">Apply</a>'),true);
 assert.equal(hasEmployerApplicationLink(url,'<a href="https://www.janestreet.com/join-jane-street/apply/8573726002">Apply</a>'),true);
 assert.equal(hasEmployerApplicationLink(url,'<a href="/join-jane-street/apply/1111111/">Apply</a>'),false);
 assert.equal(hasEmployerApplicationLink(url,'<a href="https://evil.test/join-jane-street/apply/8573726002/">Apply</a>'),false);
 assert.equal(hasEmployerApplicationLink(url.replace('https:','http:'),'<a href="/join-jane-street/apply/8573726002/">Apply</a>'),false);
});
