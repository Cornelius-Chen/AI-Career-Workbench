import test from 'node:test';
import assert from 'node:assert/strict';
import {leverPostingInfo,parseLeverPosting} from '../lib/lever.ts';
const id='95e0d2b0-437a-4096-a5c6-0f247f426c90',url=`https://jobs.lever.co/palantir/${id}`;
const expected={board:'palantir',id};
const posting={id,text:'PCL Engineer New Grad',applyUrl:url+'/apply',descriptionPlain:'Build AI tools',descriptionBodyPlain:'\n',descriptionBody:'<p>Customer governance workflows</p>',lists:[{text:'Requirements',content:'<li>Fall 2026 or Spring 2027</li>'}],additionalPlain:'Salary excludes bonus',categories:{location:'New York, NY',commitment:'Full-time'}};
test('exact public Lever posting and application path resolve to one job',()=>{
 assert.deepEqual(leverPostingInfo(url),expected);assert.deepEqual(leverPostingInfo(url+'/apply'),expected);
 for(const bad of [url.replace('https:','http:'),url.replace('jobs.lever.co','jobs.lever.co.evil.test'),url+'/other',url.replace('/palantir/','/a/b/')])assert.equal(leverPostingInfo(bad),null);
 const parsed=parseLeverPosting(posting,expected);assert.match(parsed.description,/Fall 2026/);assert.match(parsed.description,/Customer governance workflows/);assert.match(parsed.description,/excludes bonus/);assert.equal(parsed.employment,'Full-time');
});
test('wrong posting, wrong company, missing body, or untrusted apply link never passes verification',()=>{
 for(const changes of [{id:'different'},{applyUrl:''},{applyUrl:url.replace('palantir','other')+'/apply'},{applyUrl:'https://example.com/apply'},{descriptionPlain:'',descriptionBody:'',lists:[],additionalPlain:''}])assert.throws(()=>parseLeverPosting({...posting,...changes},expected));
});
