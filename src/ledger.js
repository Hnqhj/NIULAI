const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const VALID_STATUSES = new Set([
  'discovered', 'matched', 'selected', 'loaded', 'running', 'handoff',
  'validating', 'completed', 'skipped', 'blocked', 'retrying', 'failed'
]);

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '', 'utf8');
}

function normalizeEvent(input, previousEvents = []) {
  if (!input || typeof input !== 'object') throw new Error('Event body must be an object.');
  const status = String(input.status || '').trim();
  if (!VALID_STATUSES.has(status)) throw new Error(`Unsupported status: ${status}`);
  const runId = String(input.runId || '').trim();
  const skill = String(input.skill || '').trim();
  if (!runId || !skill) throw new Error('runId and skill are required.');
  const sequence = previousEvents.filter((event) => event.runId === runId).length + 1;
  return {
    eventId: input.eventId || crypto.randomUUID(),
    runId,
    taskId: String(input.taskId || runId),
    taskTitle: String(input.taskTitle || 'Untitled task'),
    skill,
    ownerSurface: String(input.ownerSurface || ''),
    phase: String(input.phase || ''),
    status,
    message: String(input.message || ''),
    reason: String(input.reason || ''),
    sequence,
    timestamp: input.timestamp || new Date().toISOString()
  };
}

function readEvents(filePath) {
  ensureParent(filePath);
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp) || a.sequence - b.sequence);
}

function appendEvent(filePath, input) {
  const events = readEvents(filePath);
  const event = normalizeEvent(input, events);
  fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, 'utf8');
  return event;
}

function summarizeRuns(events) {
  const map = new Map();
  for (const event of events) {
    if (!map.has(event.runId)) {
      map.set(event.runId, {
        runId: event.runId,
        taskId: event.taskId,
        taskTitle: event.taskTitle,
        startedAt: event.timestamp,
        updatedAt: event.timestamp,
        events: [],
        skills: new Map()
      });
    }
    const run = map.get(event.runId);
    run.updatedAt = event.timestamp;
    run.events.push(event);
    run.skills.set(event.skill, event);
  }
  return [...map.values()].map((run) => ({
    ...run,
    skills: [...run.skills.values()],
    active: [...run.skills.values()].some((event) => ['running', 'handoff', 'validating', 'retrying'].includes(event.status))
  })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

module.exports = { VALID_STATUSES, appendEvent, normalizeEvent, readEvents, summarizeRuns };
