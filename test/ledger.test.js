const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEvent, summarizeRuns } = require('../src/ledger');

test('rejects unknown statuses', () => {
  assert.throws(() => normalizeEvent({ runId: 'r1', skill: 's1', status: 'thinking' }), /Unsupported status/);
});

test('summarizes latest state for each skill', () => {
  const events = [
    normalizeEvent({ runId: 'r1', skill: 'director', status: 'running', taskTitle: 'Test' }),
    normalizeEvent({ runId: 'r1', skill: 'director', status: 'completed', taskTitle: 'Test' }, [{ runId: 'r1' }])
  ];
  const runs = summarizeRuns(events);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].skills[0].status, 'completed');
});
