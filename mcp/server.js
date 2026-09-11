const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');

const configuredRoot = process.env.SKILL_CONSOLE_ROOT;
const root = configuredRoot && path.isAbsolute(configuredRoot)
  ? path.resolve(configuredRoot)
  : path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const { appendEvent } = require(path.join(src, 'ledger'));
const { buildSnapshot } = require(path.join(src, 'service'));
const paths = require(path.join(src, 'paths'));
const { preparePromptCompilation, preflightPromptForGeneration, promptCompilationStatus, compilePromptForGeneration } = require(path.join(src, 'orchestration'));

function ensureConsoleServer() {
  if (process.env.SKILL_CONSOLE_AUTOSTART === '0') return;
  const request = http.get('http://127.0.0.1:4187/api/health', (response) => response.resume());
  request.setTimeout(350, () => request.destroy());
  request.on('error', () => {
    const child = spawn(process.execPath, [path.join(root, 'src', 'server.js')], {
      cwd: root,
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
  });
}

ensureConsoleServer();

function reply(id, result, error) {
  const body = error ? { jsonrpc: '2.0', id, error } : { jsonrpc: '2.0', id, result };
  process.stdout.write(`${JSON.stringify(body)}\n`);
}

function tool(name, description, inputSchema, handler) {
  return { name, description, inputSchema, handler };
}

const tools = [
  tool('skill_console_overview', 'Read the Skill registry, routing audit, contract, and latest run status.', { type: 'object', properties: {}, additionalProperties: false }, () => buildSnapshot({ force: true })),
  tool('skill_console_emit_event', 'Record one explicit Skill route event. This never infers hidden reasoning.', {
    type: 'object',
    required: ['runId', 'skill', 'status'],
    properties: {
      runId: { type: 'string' }, taskId: { type: 'string' }, taskTitle: { type: 'string' }, skill: { type: 'string' },
      ownerSurface: { type: 'string' }, phase: { type: 'string' }, status: { type: 'string' }, message: { type: 'string' }, reason: { type: 'string' }
    }, additionalProperties: false
  }, (args) => appendEvent(paths.ledgerPath, args)),
  tool('skill_console_open', 'Return the local dashboard URL.', { type: 'object', properties: {}, additionalProperties: false }, () => ({ url: 'http://127.0.0.1:4187/' }))
  ,tool('skill_console_prompt_compilation_context', 'Read the current task workflow and prompt complexity settings immediately before prompt compilation, then return the compiler profile.', {
    type: 'object',
    required: ['threadId'],
    properties: {
      threadId: { type: 'string' }, cwd: { type: 'string' }, codexHome: { type: 'string' }, input: { type: 'object' }
    }, additionalProperties: false
  }, (args) => preparePromptCompilation(args))
  ,tool('skill_console_prompt_preflight', 'Check whether a prompt is ready for generation using the current task workflow and prompt complexity settings.', {
    type: 'object',
    required: ['threadId'],
    properties: {
      threadId: { type: 'string' }, cwd: { type: 'string' }, codexHome: { type: 'string' }, compiler: { type: 'string' }, promptText: { type: 'string' }, input: { type: 'object' }
    }, additionalProperties: false
  }, (args) => preflightPromptForGeneration(args))
  ,tool('skill_console_prompt_compilation_status', 'Read whether the current task has a prompt compilation receipt that still matches its workflow, complexity, and compiler.', {
    type: 'object',
    required: ['threadId'],
    properties: {
      threadId: { type: 'string' }, cwd: { type: 'string' }, codexHome: { type: 'string' }, compiler: { type: 'string' }, input: { type: 'object' }
    }, additionalProperties: false
  }, (args) => promptCompilationStatus(args))
  ,tool('skill_console_compile_prompt', 'Compile one generation prompt using the current task workflow and prompt complexity settings. The task context is reread for every call.', {
    type: 'object',
    required: ['threadId', 'promptText'],
    properties: {
      threadId: { type: 'string' }, groupId: { type: ['string', 'number', 'null'] }, variantId: { type: 'string' }, cwd: { type: 'string' }, codexHome: { type: 'string' },
      promptText: { type: 'string', minLength: 1 }, compiler: { type: 'string' }, input: { type: 'object' }
    }, additionalProperties: false
  }, (args) => compilePromptForGeneration(args))
];

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  let request;
  try { request = JSON.parse(line); } catch { return; }
  const id = request.id ?? null;
  if (request.method === 'initialize') {
    return reply(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'director-skill-console', version: '0.4.0' } });
  }
  if (request.method === 'notifications/initialized') return;
  if (request.method === 'tools/list') {
    return reply(id, { tools: tools.map(({ handler, ...definition }) => definition) });
  }
  if (request.method === 'tools/call') {
    const target = tools.find((candidate) => candidate.name === request.params?.name);
    if (!target) return reply(id, null, { code: -32601, message: `Unknown tool: ${request.params?.name}` });
    try {
      const result = target.handler(request.params?.arguments || {});
      return reply(id, { content: [{ type: 'text', text: JSON.stringify(result) }] });
    } catch (error) {
      return reply(id, null, { code: -32000, message: error.message });
    }
  }
  if (request.method) reply(id, null, { code: -32601, message: `Unsupported method: ${request.method}` });
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
