import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationLimitIsReached, missingSpokenLanguage } from '../lib/domain.ts';

const softwareLimit = {
  companyGroup: 'ramp',
  titleKeywords: ['Software Engineer'],
  maxAttempts: 2,
  windowDays: 60,
  evidence: 'Official form: two software engineering applications in 60 days',
  sourceUrl: 'https://jobs.ashbyhq.com/ramp',
  observedAt: '2026-09-28T00:00:00.000Z',
};

test('an observed job-family cap blocks a third related application', () => {
  assert.equal(applicationLimitIsReached(softwareLimit, 'Software Engineer, Backend', [
    'Software Engineer, Frontend',
    'Software Engineer, Agent',
  ]), true);
});

test('a family-specific cap does not block unrelated jobs', () => {
  assert.equal(applicationLimitIsReached(softwareLimit, 'Data Scientist', [
    'Software Engineer, Frontend',
    'Software Engineer, Agent',
  ]), false);
  assert.equal(applicationLimitIsReached(softwareLimit, 'Software Engineer, Backend', [
    'Software Engineer, Frontend',
    'Data Scientist',
  ]), false);
});

test('an employer-wide cap counts every title', () => {
  assert.equal(applicationLimitIsReached({ ...softwareLimit, titleKeywords: [] }, 'AI Engineer', [
    'Data Scientist',
    'Software Engineer',
  ]), true);
});

test('language-specific roles require an owner-confirmed language fact', () => {
  assert.equal(missingSpokenLanguage('Strategist, Agent Development (Spanish speaking)', []), 'spanish');
  assert.equal(missingSpokenLanguage('Forward Deployed Engineer - Madrid (Spanish-speaking)', []), 'spanish');
  assert.equal(missingSpokenLanguage('Agent Deployment Engineer - Spanish Speaking', []), 'spanish');
  assert.equal(missingSpokenLanguage('Customer Support Associate, Bilingual - Ukrainian (Starlink)', []), 'ukrainian');
  assert.equal(missingSpokenLanguage('[Contract] Language Training Specialist - Japanese', []), 'japanese');
  assert.equal(missingSpokenLanguage('Agent Experience Designer, Voice (Multilingual)', []), 'multilingual');
  assert.equal(missingSpokenLanguage('Software Engineer, Agent (New Grad 2027)', []), null);
  const skills = [{ category: 'Skills', confirmed: true, tags: ['spoken-language:spanish'] }];
  assert.equal(missingSpokenLanguage('Strategist, Agent Development (Spanish speaking)', skills), null);
});
