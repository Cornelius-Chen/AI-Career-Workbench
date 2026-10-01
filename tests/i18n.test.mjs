import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
import {formatMessage} from '../lib/i18n-messages.ts';
const messages=JSON.parse(fs.readFileSync(new URL('../lib/locales/en.json',import.meta.url),'utf8'));
const chinese=/[\u3400-\u9fff]/;
const files=['app/workspace.tsx',...fs.readdirSync('app/team').filter(f=>f.endsWith('.tsx')).map(f=>'app/team/'+f)];

test('all translated UI messages have English copy and matching interpolation slots',()=>{
 for(const file of files){const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function visit(node){
   if(ts.isCallExpression(node)&&node.expression.getText(source)==='tr'&&ts.isStringLiteral(node.arguments[0]))assert.ok(node.arguments[0].text in messages,`${file}: ${node.arguments[0].text}`);
   if(ts.isJsxText(node))assert.equal(chinese.test(node.text),false,`${file}: untranslated JSX text`);
   ts.forEachChild(node,visit);
  }visit(source);
 }
 const slots=s=>[...s.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort();
 for(const[key,copy]of Object.entries(messages)){assert.equal(chinese.test(copy),false,key);assert.deepEqual(slots(key),slots(copy),key)}
});

test('both languages interpolate member names and counts while preserving original content',()=>{
 assert.equal(formatMessage('协作空间 · {0} 位成员','en',3),'Collaboration · 3 members');
 assert.equal(formatMessage('协作空间 · {0} 位成员','zh',3),'协作空间 · 3 位成员');
 assert.equal(formatMessage('推荐给 {0}','en','陈同学'),'Recommended for 陈同学');
 assert.equal(formatMessage('陈同学的原始简历内容','en'),'陈同学的原始简历内容');
 assert.equal(formatMessage('Original note with {0}','en'),'Original note with {0}');
});

test('localized native select labels retain explicit language-independent values',()=>{
 for(const file of files){const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function visit(node){if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(source)==='option')assert.ok(node.openingElement.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==='value'),`${file}: missing option value`);ts.forEachChild(node,visit)}visit(source)}
});
