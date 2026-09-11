const fs = require('node:fs');
const path = require('node:path');

const cache = new Map();
const MAX_RUNS = 80;

function safeJson(line) {
  try { return JSON.parse(line); } catch { return null; }
}

function readIndex(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(safeJson)
    .filter((entry) => entry && entry.id)
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
}

function findSessionFiles(root) {
  const files = [];
  const walk = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(filePath);
      else if (/^rollout-.*\.jsonl$/i.test(entry.name)) files.push(filePath);
    }
  };
  walk(root);
  return files;
}

function sessionIdFromFile(filePath) {
  let handle;
  try {
    handle = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(512 * 1024);
    const length = fs.readSync(handle, buffer, 0, buffer.length, 0);
    const firstLine = buffer.toString('utf8', 0, length).split(/\r?\n/, 1)[0];
    const meta = safeJson(firstLine);
    return String(meta?.payload?.id || meta?.payload?.session_id || '').toLowerCase();
  } catch {
    return '';
  } finally {
    if (handle !== undefined) try { fs.closeSync(handle); } catch {}
  }
}

function skillFromPath(value) {
  return skillsFromInput(value)[0] || null;
}

function skillsFromInput(value) {
  const text = String(value || '').replace(/\\\\+/g, '\\').replace(/\/{2,}/g, '/');
  // Patch bodies and source-code writes are not Skill loads.
  if (/\*\*\* (?:Begin Patch|Add File)|writeFile|Set-Content/.test(text)) return [];
  const paths = [...text.matchAll(/(?:[A-Za-z]:[\\/]|\/)[^'"`\r\n<>|]*?[\\/]SKILL\.md/gi)];
  return [...new Map(paths.map(([sourcePath]) => {
    const parts = sourcePath.split(/[\\/]/);
    return [sourcePath, { name: parts.at(-2), sourcePath }];
  })).values()];
}

function outputText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(outputText).filter(Boolean).join('\n');
  if (typeof value === 'object') return [value.text, value.output, value.message, value.error].map(outputText).filter(Boolean).join('\n');
  return String(value);
}

function failureReason(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const line = lines.find((item) => /^(?:[A-Za-z_$][\w$]*(?:Error|Exception):|Error:|CommandNotFoundException)/i.test(item)) || lines.find((item) => /^(Script failed|Exit code:\s*[1-9]\d*\b|Traceback(?:\s|:))/i.test(item));
  if (!line) return 'Skill 工具调用失败';
  if (/^Script failed$/i.test(line)) return '命令执行失败（Script failed）';
  if (/^Exit code:\s*[1-9]/i.test(line)) return `命令退出码异常（${line}）`;
  return line.slice(0, 280);
}

function turnIdFrom(record) {
  const payload = record?.payload || {};
  return payload.turn_id || payload.internal_chat_message_metadata_passthrough?.turn_id || '';
}

function messageText(payload) {
  if (payload?.type !== 'message' || payload.role !== 'user') return '';
  const texts = (payload.content || []).map((item) => item?.text || '').filter((text) => text && !/^\s*</.test(text));
  const raw = texts.find((text) => /My request(?: for Codex)?:/i.test(text)) || texts.at(-1) || '';
  if (/^\s*#\s*(?:AGENTS\.md instructions|Files mentioned by the user)/i.test(raw) && !/My request(?: for Codex)?:/i.test(raw)) return '';
  const request = raw.match(/My request(?: for Codex)?:\s*([\s\S]*)/i)?.[1] || raw;
  return request.replace(/^\s*# Files mentioned by the user:[\s\S]*?(?=\bMy request for Codex:)/i, '').replace(/<in-app-browser-context[\s\S]*?<\/in-app-browser-context>/gi, '').trim();
}

function parseSession(filePath, indexed) {
  return parseSessionFiles([filePath], indexed);
}

function parseSessionFiles(filePaths, indexed) {
  const sources = [...new Set(filePaths)].filter((item) => fs.existsSync(item)).sort();
  const stats = sources.map((sourcePath) => fs.statSync(sourcePath));
  const cacheKey = sources.join('\u0000');
  const signature = stats.map((stat) => `${stat.size}:${stat.mtimeMs}`).join('|');
  const cached = cache.get(cacheKey);
  if (cached?.signature === signature) return cached.value;
  const records = sources.flatMap((sourcePath) => fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/).filter(Boolean).map(safeJson).filter(Boolean));
  const meta = records.find((record) => record.type === 'session_meta')?.payload || {};
  const outputByCall = new Map();
  const conversationTitles = new Map();
  for (const record of records) {
    const payload = record.payload || {};
    if (record.type === 'response_item' && ['custom_tool_call_output', 'function_call_output'].includes(payload.type) && payload.call_id) {
      outputByCall.set(payload.call_id, { record, payload });
    }
    const turnId = turnIdFrom(record);
    const text = messageText(payload).replace(/\s+/g, ' ').trim();
    if (turnId && text && !conversationTitles.has(turnId)) conversationTitles.set(turnId, text.slice(0, 90));
  }

  const events = [];
  const skills = [];
  let startedAt = meta.timestamp || indexed.updated_at || stats[0]?.birthtime.toISOString() || new Date().toISOString();
  let updatedAt = startedAt;
  let lastCompleteAt = null;
  let lastStartedAt = null;
  let lastErrorAt = null;
  let hasError = false;
  let activeTurn = '';
  for (const record of records) {
    const timestamp = record.timestamp || record.payload?.timestamp || updatedAt;
    if (timestamp && new Date(timestamp) > new Date(updatedAt)) updatedAt = timestamp;
    const payload = record.payload || {};
    const kind = payload.type || record.type;
    if (kind === 'task_started' || record.type === 'turn_context') activeTurn = payload.turn_id || activeTurn || `turn-${events.length}`;
    const conversationId = activeTurn || (messageText(payload) ? turnIdFrom(record) : '') || 'session';
    const userText = messageText(payload).replace(/\s+/g, ' ').trim();
    if (userText && !conversationTitles.has(conversationId)) conversationTitles.set(conversationId, userText.slice(0, 90));
    if (kind === 'task_started') {
      startedAt = timestamp || startedAt;
      lastStartedAt = timestamp;
      events.push({ type: 'task', status: 'running', label: '对话开始', conversationId, timestamp });
    } else if (kind === 'task_complete') {
      lastCompleteAt = timestamp;
      const reason = payload.error?.message || payload.error || '';
      if (reason) {
        hasError = true;
        lastErrorAt = timestamp;
        events.push({ type: 'task', status: 'failed', label: '对话失败', message: String(reason), reason: String(reason), conversationId, timestamp });
      } else {
        events.push({ type: 'task', status: 'completed', label: '对话完成', conversationId, timestamp });
      }
    } else if (kind === 'error' || record.type === 'error') {
      hasError = true;
      lastErrorAt = timestamp;
      const reason = payload.message || payload.error || payload.reason || '对话发生异常';
      events.push({ type: 'task', status: 'failed', label: '对话异常', message: reason, reason, conversationId, timestamp });
    }
    if (record.type !== 'response_item' || !['custom_tool_call', 'function_call'].includes(payload.type)) continue;
    if (/apply_patch|write|edit/i.test(payload.name || '')) continue;
    const detectedSkills = skillsFromInput(payload.input || payload.arguments);
    for (const skill of detectedSkills) {
    const output = outputByCall.get(payload.call_id);
    const outputBody = output?.payload?.output ?? output?.payload ?? '';
    const outputContent = outputText(outputBody);
    const failed = output && (/^\s*Script failed\b/m.test(outputContent) || /Exit code:\s*[1-9]\b/.test(outputContent) || /^\s*[A-Za-z_$][\w$]*(?:Error|Exception):/im.test(outputContent) || /CommandNotFoundException|Traceback(?:\s|:)/i.test(outputContent) || output.payload?.status === 'failed');
    const pending = /Script running with cell ID|Process running with session ID|"session_id"\s*:\s*\d+/.test(outputContent);
    const status = !output ? 'running' : failed ? 'failed' : pending ? 'unknown' : 'completed';
    const completedAt = output?.record?.timestamp || output?.payload?.timestamp || null;
    const startedMs = Date.parse(timestamp);
    const completedMs = Date.parse(completedAt || '');
    const event = {
      type: 'skill',
      conversationId,
      skill: skill.name,
      status,
      label: failed ? '读取 SKILL.md 失败' : '读取 SKILL.md',
      message: failed ? failureReason(outputContent) : status === 'completed' ? 'SKILL.md 读取完成；不代表技能工作流已执行成功' : '尚未观测到最终读取结果',
      reason: failed ? failureReason(outputContent) : '',
      timestamp,
      completedAt,
      durationMs: Number.isFinite(startedMs) && Number.isFinite(completedMs)
        ? Math.max(0, completedMs - startedMs)
        : null,
      callId: payload.call_id || payload.id || null,
      sourcePath: skill.sourcePath,
      tool: payload.name || 'custom_tool_call'
    };
    skills.push(event);
    events.push(event);
    }
  }
  const lastSkillFailure = skills.slice().reverse().find((event) => event.status === 'failed');
  const latestTaskEvent = events.filter((event) => event.type === 'task').at(-1);
  const finalStatus = latestTaskEvent?.status
    || (lastSkillFailure ? 'failed' : lastCompleteAt && (!lastStartedAt || new Date(lastCompleteAt) >= new Date(lastStartedAt)) ? 'completed' : 'running');
  const title = indexed.thread_name || meta.thread_name || `任务 ${String(meta.id || indexed.id).slice(0, 8)}`;
  const conversationMap = new Map();
  for (const [conversationId, conversationTitle] of conversationTitles) {
    conversationMap.set(conversationId, { conversationId, title: conversationTitle, events: [] });
  }
  for (const event of events) {
    const conversationId = event.conversationId || 'session';
    if (!conversationMap.has(conversationId)) conversationMap.set(conversationId, { conversationId, title: conversationId === 'session' ? '会话记录' : `对话 ${conversationMap.size + 1}`, events: [] });
    conversationMap.get(conversationId).events.push(event);
  }
  const conversations = [...conversationMap.values()].map((conversation, index) => {
    const conversationEvents = conversation.events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const conversationSkills = conversationEvents.filter((event) => event.type === 'skill');
    const failedEvent = conversationEvents.slice().reverse().find((event) => event.status === 'failed');
    const latestConversationTask = conversationEvents.filter((event) => event.type === 'task').at(-1);
    return {
      ...conversation,
      title: conversation.title || `对话 ${index + 1}`,
      startedAt: conversationEvents[0]?.timestamp || startedAt,
      updatedAt: conversationEvents.at(-1)?.timestamp || updatedAt,
      status: latestConversationTask?.status || (failedEvent ? 'failed' : 'running'),
      failureReason: failedEvent?.reason || failedEvent?.message || '',
      skills: conversationSkills,
      eventCount: conversationEvents.length,
    };
  }).filter((conversation) => conversation.events.length);
  const value = {
    runId: indexed.id || meta.id || path.basename(filePath, '.jsonl'),
    taskId: indexed.id || meta.id,
    taskTitle: title,
    cwd: meta.cwd || '',
    project: meta.cwd ? path.basename(meta.cwd) : '未标注项目',
    startedAt,
    updatedAt: new Date(updatedAt) > new Date(indexed.updated_at || 0) ? updatedAt : indexed.updated_at,
    status: finalStatus,
    active: finalStatus === 'running',
    source: 'codex-session',
    sourceFile: sources.at(-1) || '',
    sourceFiles: sources,
    skills,
    events: events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
    eventCount: events.length,
    currentPhase: skills.at(-1)?.skill || (finalStatus === 'completed' ? '已完成' : '执行中'),
    failureReason: lastSkillFailure?.reason || (hasError ? events.slice().reverse().find((event) => event.status === 'failed')?.reason : '') || '',
    conversations,
  };
  cache.set(cacheKey, { signature, value });
  return value;
}

function readLiveRuns({ force = false } = {}) {
  const index = readIndex(require('./paths').sessionIndexPath);
  const files = findSessionFiles(require('./paths').sessionsDir);
  const byId = new Map();
  for (const filePath of files) {
    const sessionId = sessionIdFromFile(filePath)
      || path.basename(filePath).match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1]?.toLowerCase();
    if (!sessionId) continue;
    const entries = byId.get(sessionId) || [];
    entries.push(filePath);
    byId.set(sessionId, entries);
  }
  const runs = [];
  const seen = new Set();
  for (const entry of index.slice(0, MAX_RUNS * 2)) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    const sessionFiles = byId.get(String(entry.id).toLowerCase());
    if (!sessionFiles?.length) continue;
    try { runs.push(parseSessionFiles(sessionFiles, entry)); } catch { /* a live rollout can be mid-write */ }
    if (runs.length >= MAX_RUNS) break;
  }
  return runs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

module.exports = { readLiveRuns, parseSession, parseSessionFiles, skillFromPath, skillsFromInput, turnIdFrom };
