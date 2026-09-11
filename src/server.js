const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { appendEvent } = require('./ledger');
const paths = require('./paths');
const { getEventToken, isAuthorized } = require('./security');
const { buildSnapshot, clearCache } = require('./service');
const { readLiveRuns } = require('./live-sessions');

const host = process.env.SKILL_CONSOLE_HOST || '127.0.0.1';
const port = Number(process.env.SKILL_CONSOLE_PORT || 4187);
const streamClients = new Set();
let sessionSignature = '';

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of streamClients) {
    try { client.write(payload); } catch { streamClients.delete(client); }
  }
}

function watchSessions() {
  try {
    const runs = readLiveRuns({ force: true });
    const signature = runs.map((run) => `${run.runId}:${run.updatedAt}:${run.status}:${run.skills.length}`).join('|');
    if (sessionSignature && signature !== sessionSignature) broadcast('session-update', { generatedAt: new Date().toISOString() });
    sessionSignature = signature;
  } catch {}
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function send(response, status, body, type = 'application/json; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self' app: http://127.0.0.1:* http://localhost:* https://web-sandbox.oaiusercontent.com"
  });
  response.end(Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body));
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) reject(new Error('Request body too large.'));
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON.')); }
    });
    request.on('error', reject);
  });
}

async function handler(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);
  if (request.method === 'GET' && url.pathname === '/api/events/stream') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    response.write(`event: ready\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`);
    streamClients.add(response);
    const heartbeat = setInterval(() => {
      try { response.write(`event: heartbeat\ndata: ${Date.now()}\n\n`); } catch {}
    }, 15_000);
    request.on('close', () => {
      clearInterval(heartbeat);
      streamClients.delete(response);
    });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/overview') {
    return send(response, 200, buildSnapshot({ force: url.searchParams.get('refresh') === '1' }));
  }
  if (request.method === 'GET' && url.pathname === '/api/skills') {
    // 轻量技能目录：供侧栏注入器推送给技能工作台（复用 15 秒快照缓存）。
    const snapshot = buildSnapshot({});
    return send(response, 200, {
      generatedAt: snapshot.generatedAt,
      // Keep the management view self-contained: version/provenance metadata
      // travels with each skill instead of requiring a second registry page.
      skills: snapshot.index.skills.map((skill) => ({
        name: skill.name,
        displayName: skill.displayName || skill.name,
        description: skill.description,
        shortDescription: skill.shortDescription || '',
        defaultPrompt: skill.defaultPrompt || '',
        category: skill.category,
        filePath: skill.filePath,
        directory: skill.directory,
        modifiedAt: skill.modifiedAt,
        lines: skill.lines,
        mentions: Array.isArray(skill.mentions) ? skill.mentions : [],
        references: Array.isArray(skill.references) ? skill.references : [],
        version: skill.version || null,
      }))
    });
  }
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return send(response, 200, { ok: true, host, port, generatedAt: new Date().toISOString() });
  }
  if (request.method === 'POST' && url.pathname === '/api/events') {
    if (!isAuthorized(request)) return send(response, 401, { error: 'Unauthorized.' });
    try {
      const event = appendEvent(paths.ledgerPath, await parseBody(request));
      clearCache();
      broadcast('skill', event);
      return send(response, 201, event);
    } catch (error) {
      return send(response, 400, { error: error.message });
    }
  }
  if (request.method !== 'GET') return send(response, 405, { error: 'Method not allowed.' });

  const relative = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const filePath = path.resolve(paths.publicDir, relative);
  if (!filePath.startsWith(path.resolve(paths.publicDir) + path.sep) && filePath !== path.join(paths.publicDir, 'index.html')) {
    return send(response, 403, { error: 'Forbidden.' });
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return send(response, 404, { error: 'Not found.' });
  return send(response, 200, fs.readFileSync(filePath), mime[path.extname(filePath)] || 'application/octet-stream');
}

const server = http.createServer((request, response) => {
  handler(request, response).catch((error) => send(response, 500, { error: error.message }));
});

server.listen(port, host, () => {
  getEventToken();
  console.log(`Skill Director Console: http://${host}:${port}`);
  console.log(`Event token: ${path.relative(paths.projectRoot, require('./security').tokenPath)}`);
  setInterval(watchSessions, 3000);
});

function shutdown() {
  for (const client of streamClients) {
    try { client.end(); } catch {}
  }
  streamClients.clear();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
