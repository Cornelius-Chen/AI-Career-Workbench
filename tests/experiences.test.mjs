import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const facts=JSON.parse(readFileSync(new URL('../data/manually-reviewed-resume.json',import.meta.url),'utf8'));
test('manual review keeps complete records and latest education',()=>{
 const main=facts.filter(f=>!f.historical);assert.equal(main.length,10);assert.equal(facts.filter(f=>f.historical).length,6);
 assert.equal(main.filter(f=>f.category==='Education').length,2);assert.equal(main.filter(f=>f.category==='Experience').length,5);assert.equal(main.filter(f=>f.category==='Projects').length,2);
 const education=main.filter(f=>f.category==='Education').map(f=>f.text).join(' ');assert.match(education,/December 2026/);assert.match(education,/Theory & Methods Honors; Advanced Machine Learning/);assert.doesNotMatch(education,/March 2027/);
 assert.ok(main.filter(f=>f.category==='Experience').slice(0,3).every(f=>f.experienceType==='Externship'));
 assert.ok(main.filter(f=>f.category!=='Education').every(f=>!f.confirmed));
 assert.equal(new Set(facts.map(f=>f.id)).size,16);
});
