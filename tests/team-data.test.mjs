import test from 'node:test';
import assert from 'node:assert/strict';
import {loadOwnerApplications} from '../lib/team-data.ts';

test('parallel cursor streams retain all applications and evidence across page boundaries', async t => {
  const applications = Array.from({length: 405}, (_, i) => ({id: 'legacy:' + String(i).padStart(4, '0'), events: [], status: i === 199 ? 'uncertain' : 'submitted'}));
  const events = Array.from({length: 400}, (_, i) => ({cursorId: String(i).padStart(4, '0'), applicationId: String(Math.floor(i / 2)).padStart(4, '0'), stage: 'submitted', accepted: i !== 399}));
  const datasets = {'owner-applications': applications, 'owner-events': events};
  const calls = [];
  const gates = {'owner-applications': Promise.withResolvers(), 'owner-events': Promise.withResolvers()};
  t.mock.method(globalThis, 'fetch', async url => {
    const params = new URL(url, 'http://local.test').searchParams;
    const view = params.get('view'), cursor = params.get('cursor');
    calls.push({view, cursor});
    if (!cursor) await gates[view].promise;
    const start = cursor ? Number(cursor) + 1 : 0;
    return Response.json(datasets[view].slice(start, start + 200));
  });
  const pending = loadOwnerApplications();
  assert.deepEqual(calls.map(call => call.view), ['owner-applications', 'owner-events']);
  gates['owner-applications'].resolve();
  gates['owner-events'].resolve();
  const result = await pending;
  assert.equal(result.length, 405);
  assert.equal(result[404].id, 'legacy:0404');
  assert.equal(result.reduce((n, row) => n + row.events.length, 0), 400);
  assert.deepEqual(result[199].events, [events[398], events[399]]);
  assert.equal(result[199].status, 'uncertain');
  assert.equal(result[199].events[1].accepted, false);
  assert.deepEqual(result[200].events, []);
  assert.deepEqual(applications[199].events, []);
  assert.deepEqual(calls.filter(call => call.view === 'owner-events').map(call => call.cursor), ['', '0199', '0399']);
});

test('an empty or member-restricted stream returns no owner records', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json([]));
  assert.deepEqual(await loadOwnerApplications(), []);
});

test('a failed later page reports the error instead of returning a partial application list', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    const params = new URL(url, 'http://local.test').searchParams;
    if (params.get('view') === 'owner-events') return Response.json([]);
    if (params.get('cursor')) return Response.json({error: 'page unavailable'}, {status: 400});
    return Response.json(Array.from({length: 200}, (_, i) => ({id: 'legacy:' + i, events: []})));
  });
  await assert.rejects(loadOwnerApplications(), /page unavailable/);
});
