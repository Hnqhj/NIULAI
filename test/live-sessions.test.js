const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseSession, parseSessionFiles } = require('../src/live-sessions');

test('marks a conversation failed and preserves the Skill failure reason', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-session-'));
  const filePath = path.join(directory, 'rollout-test.jsonl');
  const records = [
    { type: 'session_meta', payload: { id: 'run-test', cwd: directory, timestamp: '2026-09-09T00:00:00.000Z' } },
    { timestamp: '2026-09-09T00:00:01.000Z', type: 'response_item', payload: { type: 'custom_tool_call', call_id: 'call-1', name: 'exec', input: 'Get-Content SKILL.md' } },
    { timestamp: '2026-09-09T00:00:02.000Z', type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'call-1', output: [{ type: 'input_text', text: 'Exit code: 1' }] } },
  ];
  records[1].payload.input = path.join(directory, 'skills', 'demo-skill', 'SKILL.md');
  fs.mkdirSync(path.dirname(records[1].payload.input), { recursive: true });
  fs.writeFileSync(filePath, records.map((record) => JSON.stringify(record)).join('\n'));
  const run = parseSession(filePath, { id: 'run-test', updated_at: '2026-09-09T00:00:02.000Z', thread_name: '对话诊断测试' });
  assert.equal(run.status, 'failed');
  assert.equal(run.skills[0].status, 'failed');
  assert.equal(run.skills[0].reason, '命令退出码异常（Exit code: 1）');
  assert.equal(run.skills[0].completedAt, '2026-09-09T00:00:02.000Z');
  assert.equal(run.skills[0].durationMs, 1000);
  assert.equal(run.failureReason, run.skills[0].reason);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('merges resumed rollout files by session and uses the latest turn status', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-resumed-'));
  const firstPath = path.join(directory, 'rollout-2026-09-09T00-00-00-run.jsonl');
  const resumedPath = path.join(directory, 'rollout-2026-09-10T00-00-00-run_turn.jsonl');
  const skillPath = path.join(directory, 'skills', 'resumed-skill', 'SKILL.md');
  fs.mkdirSync(path.dirname(skillPath), { recursive: true });
  fs.writeFileSync(firstPath, [
    { type: 'session_meta', payload: { id: 'run-resumed', cwd: directory, timestamp: '2026-09-09T00:00:00.000Z' } },
    { timestamp: '2026-09-09T00:00:01.000Z', type: 'response_item', payload: { type: 'task_started', turn_id: 'turn-a' } },
    { timestamp: '2026-09-09T00:00:02.000Z', type: 'response_item', payload: { type: 'task_complete', turn_id: 'turn-a' } },
  ].map((record) => JSON.stringify(record)).join('\n'));
  fs.writeFileSync(resumedPath, [
    { type: 'session_meta', payload: { id: 'run-resumed', cwd: directory, timestamp: '2026-09-10T00:00:00.000Z' } },
    { timestamp: '2026-09-10T00:00:01.000Z', type: 'response_item', payload: { type: 'task_started', turn_id: 'turn-b' } },
    { timestamp: '2026-09-10T00:00:02.000Z', type: 'response_item', payload: { type: 'custom_tool_call', call_id: 'resumed', name: 'exec', input: skillPath } },
    { timestamp: '2026-09-10T00:00:03.000Z', type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'resumed', output: 'ok' } },
  ].map((record) => JSON.stringify(record)).join('\n'));
  const run = parseSessionFiles([firstPath, resumedPath], { id: 'run-resumed', updated_at: '2026-09-09T00:00:02.000Z', thread_name: 'resumed task' });
  assert.equal(run.status, 'running');
  assert.deepEqual(run.conversations.map((item) => item.conversationId), ['turn-a', 'turn-b']);
  assert.equal(run.conversations.at(-1).skills[0].skill, 'resumed-skill');
  assert.equal(run.sourceFiles.length, 2);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('keeps tool metadata in the enclosing conversation turn', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-turns-'));
  const filePath = path.join(directory, 'rollout-turns.jsonl');
  const skillPath = (name) => path.join(directory, 'skills', name, 'SKILL.md');
  fs.mkdirSync(path.dirname(skillPath('first')), { recursive: true });
  fs.mkdirSync(path.dirname(skillPath('second')), { recursive: true });
  const records = [
    { type: 'session_meta', payload: { id: 'run-turns', cwd: directory, timestamp: '2026-09-09T00:00:00.000Z' } },
    { timestamp: '2026-09-09T00:00:01.000Z', type: 'response_item', payload: { type: 'task_started', turn_id: 'turn-a' } },
    { timestamp: '2026-09-09T00:00:01.100Z', type: 'response_item', payload: { type: 'message', role: 'user', turn_id: 'turn-a', content: [{ text: 'first request' }] } },
    { timestamp: '2026-09-09T00:00:01.200Z', type: 'response_item', payload: { type: 'custom_tool_call', call_id: 'a', internal_chat_message_metadata_passthrough: { turn_id: 'wrong-a' }, name: 'exec', input: skillPath('first') } },
    { timestamp: '2026-09-09T00:00:01.300Z', type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'a', output: 'ok' } },
    { timestamp: '2026-09-09T00:00:02.000Z', type: 'response_item', payload: { type: 'task_started', turn_id: 'turn-b' } },
    { timestamp: '2026-09-09T00:00:02.100Z', type: 'response_item', payload: { type: 'message', role: 'user', turn_id: 'turn-b', content: [{ text: 'second request' }] } },
    { timestamp: '2026-09-09T00:00:02.200Z', type: 'response_item', payload: { type: 'custom_tool_call', call_id: 'b', internal_chat_message_metadata_passthrough: { turn_id: 'wrong-b' }, name: 'exec', input: skillPath('second') } },
    { timestamp: '2026-09-09T00:00:02.300Z', type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'b', output: 'ok' } },
  ];
  fs.writeFileSync(filePath, records.map((record) => JSON.stringify(record)).join('\n'));
  const run = parseSession(filePath, { id: 'run-turns', updated_at: '2026-09-09T00:00:02.300Z', thread_name: 'turn grouping' });
  assert.deepEqual(run.conversations.map((item) => item.conversationId), ['turn-a', 'turn-b']);
  assert.equal(run.conversations[0].skills[0].skill, 'first');
  assert.equal(run.conversations[1].skills[0].skill, 'second');
  fs.rmSync(directory, { recursive: true, force: true });
});
