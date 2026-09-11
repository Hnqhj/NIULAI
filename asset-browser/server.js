const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { loadLibrary, saveLibrary } = require('./database');

const PORT = Number(process.env.ASSET_BROWSER_PORT || 5177);
const HOST = process.env.ASSET_BROWSER_HOST || '127.0.0.1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_ROOT = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || process.env.USERPROFILE || os.homedir(), 'CodexSidebarEnhancer', 'asset-browser')
  : path.join(os.homedir(), '.local', 'state', 'codex-sidebar-enhancer', 'asset-browser');
const STATE_ROOT = path.resolve(process.env.ASSET_BROWSER_STATE_ROOT || DEFAULT_STATE_ROOT);
const CONFIG_PATH = path.resolve(process.env.ASSET_BROWSER_CONFIG || path.join(STATE_ROOT, 'asset-browser.config.json'));
const TOKEN_PATH = path.resolve(process.env.ASSET_BROWSER_TOKEN_FILE || path.join(STATE_ROOT, '.api-token'));
const ASSET_INDEX_PATH = path.join(STATE_ROOT, 'assets.json');
const PROMPT_INDEX_PATH = path.join(STATE_ROOT, 'prompts.json');
const GENERATION_INDEX_PATH = path.join(STATE_ROOT, 'generations.json');
const EVENT_LOG_PATH = path.join(STATE_ROOT, 'asset-events.jsonl');
const PUBLIC_ROOT = path.join(ROOT, 'asset-console', 'public');

const MEDIA_TYPES = Object.freeze({
  image: new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.avif']),
  video: new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v']),
  music: new Set(['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.opus']),
  prompt: new Set(['.prompt', '.prompt.txt', '.aigc.json']),
});
const IGNORE_DIRS = new Set(['node_modules', '.git', '.state', 'cache', 'tmp', 'temp', 'duplicate-quarantine', 'preview-cache']);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
};

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function id(prefix, value) { return `${prefix}_${crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 16)}`; }
function hashFile(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(`sha256:${hash.digest('hex')}`));
  });
}
function jsonRead(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch { return fallback; }
}
async function atomicJsonWrite(file, value) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fsp.rename(tmp, file);
}
function defaultConfig() {
  const workspace = text(process.env.ASSET_BROWSER_WORKSPACE_ROOT);
  return {
    enabled: true,
    sourceRoots: workspace ? [{ id: 'workspace', name: path.basename(workspace) || '工作区', root: path.resolve(workspace), enabled: true, watchEnabled: false, excludeRules: [] }] : [],
    projects: workspace ? [{ id: 'workspace', name: path.basename(workspace) || '工作区', root: path.resolve(workspace), enabled: true }] : [],
    storage: { stateRoot: STATE_ROOT },
    automation: { inbox: { enabled: false, capturePolicy: 'ticketed-only' }, routing: { enabled: false } },
    deduplication: { enabled: true },
  };
}
function loadConfig() {
  const current = jsonRead(CONFIG_PATH, null);
  if (current && (Array.isArray(current.sourceRoots) || Array.isArray(current.projects))) {
    if (!Array.isArray(current.sourceRoots)) current.sourceRoots = current.projects.map(project => ({ ...project, watchEnabled: false, excludeRules: [] }));
    if (!Array.isArray(current.projects)) current.projects = current.sourceRoots;
    const roots = current.sourceRoots.filter(item => item && text(item.root) && !safeInside(path.resolve(item.root), STATE_ROOT) && !safeInside(path.resolve(item.root), ROOT));
    if (roots.length !== current.sourceRoots.length) {
      current.sourceRoots = roots;
      current.projects = roots.map(({ watchEnabled, excludeRules, ...project }) => project);
      try { fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true }); fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(current, null, 2)}\n`); } catch {}
    }
    return current;
  }
  const config = defaultConfig();
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  try { fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx' }); } catch {}
  return config;
}
function loadIndex(file) {
  const value = jsonRead(file, []);
  return Array.isArray(value) ? value : [];
}
const library = loadLibrary({
  stateRoot: STATE_ROOT,
  jsonPaths: { assets: ASSET_INDEX_PATH, prompts: PROMPT_INDEX_PATH, generations: GENERATION_INDEX_PATH },
});
const libraryDb = library.db;
let assets = library.assets;
let prompts = library.prompts;
let generations = library.generations;
let sourceRoots = library.sourceRoots || [];
let collections = library.collections || [];
let savedFilters = library.savedFilters || [];
let assetRelations = library.assetRelations || [];
let scanState = { status: 'idle', scannedAt: null, added: 0, updated: 0, removed: 0, errors: [] };
let activeScan = null;
let scanCancelRequested = false;
let scanSnapshot = null;
function persistLibrary() {
  saveLibrary(libraryDb, { assets, prompts, generations, sourceRoots: allSourceRoots(), collections, savedFilters, assetRelations });
}

function configuredRoots() {
  const config = loadConfig();
  return (config.sourceRoots || config.projects || []).filter(p => p && p.enabled !== false && text(p.root)).map(p => ({ ...p, root: path.resolve(p.root) }));
}
function projectRoots() { return configuredRoots(); }
function allSourceRoots() {
  const config = loadConfig();
  return (config.sourceRoots || config.projects || []).filter(p => p && text(p.root)).map(p => {
    const root = path.resolve(p.root);
    const available = fs.existsSync(root) && (() => { try { return fs.statSync(root).isDirectory(); } catch { return false; } })();
    const assetsForRoot = assets.filter(asset => asset.sourceRootId === p.id || asset.projectId === p.id);
    return { ...p, root, available, status: available ? 'online' : 'offline', indexedCount: assetsForRoot.filter(asset => asset.availability !== 'missing').length, missingCount: assetsForRoot.filter(asset => asset.availability === 'missing' || asset.missing).length, lastScanAt: p.lastScanAt || null, watchEnabled: p.watchEnabled === true, excludeRules: Array.isArray(p.excludeRules) ? p.excludeRules : [] };
  });
}
function safeInside(file, root) {
  const target = path.resolve(file);
  const base = path.resolve(root);
  return target === base || target.startsWith(`${base}${path.sep}`);
}
function classifyKind(file) {
  const lower = file.toLowerCase();
  // Sidecars describe a neighboring media asset; they are not library items.
  if (lower.endsWith('.aigc.json')) return null;
  for (const [kind, extensions] of Object.entries(MEDIA_TYPES)) if ([...extensions].some(ext => lower.endsWith(ext))) return kind;
  return null;
}
function projectForFile(file, roots) {
  return roots.filter(root => safeInside(file, root.root)).sort((a, b) => b.root.length - a.root.length)[0] || null;
}
function parseSidecar(file) {
  const candidates = [`${file}.aigc.json`, `${file.replace(/\.[^.]+$/, '')}.aigc.json`];
  for (const candidate of candidates) {
    const value = jsonRead(candidate, null);
    if (value && typeof value === 'object') return value;
  }
  return null;
}
function inferGroup(meta, file, kind) {
  const status = text(meta?.reviewStatus || meta?.userStatus || meta?.status).toLowerCase();
  if (['rejected', '废弃', '丢弃', 'noise'].includes(status)) return 'noise';
  if (['approved', 'official', '正式', '可用', 'final'].includes(status)) return 'official';
  const lower = file.toLowerCase();
  const normalized = file.replaceAll('\\', '/');
  if (['tmp', 'temp', 'cache', 'debug', 'thumbnail', 'preview', 'duplicate-quarantine'].some(word => lower.includes(`${path.sep}${word}${path.sep}`) || lower.includes(word))) return 'noise';
  if (['丢弃', '废弃', '测试废片', '副本'].some(word => file.includes(word))) return 'noise';
  if (text(meta?.smartGroup)) return text(meta.smartGroup).toLowerCase();
  if (kind === 'prompt' || /\/(input|inputs|source|sources|reference|references|refs|samples|raw|frames|reverse|storyboard_reverse)\//i.test(normalized) || /参考素材|输入参考|外部参考|抽帧|拆帧|反推/.test(file)) return 'review';
  if (['image', 'video'].includes(kind) && (/\/(generated|generations|outputs?|assets|images|covers|candidates|renders?|exports?)\//i.test(normalized) || /母版|首帧|尾帧|角色卡|候选|测试图|资产图|封面|道具|场景|成片|最终视频/.test(file))) return 'official';
  return kind === 'prompt' ? 'review' : 'review';
}
async function walk(root, results, excludeRules = [], baseRoot = root) {
  let entries;
  try { entries = await fsp.readdir(root, { withFileTypes: true }); } catch (error) { results.errors.push(`${root}: ${error.message}`); return; }
  for (const entry of entries) {
    if (scanCancelRequested) throw Object.assign(new Error('Scan cancelled'), { code: 'SCAN_CANCELLED' });
    if (entry.name.startsWith('.') || (entry.isDirectory() && IGNORE_DIRS.has(entry.name.toLowerCase()))) continue;
    const full = path.join(root, entry.name);
    if (excludeRules.some(rule => {
      const value = text(rule).replace(/[\\/]+/g, path.sep);
      return value && (safeInside(full, path.resolve(baseRoot, value)) || path.relative(baseRoot, full).toLowerCase().includes(value.toLowerCase()));
    })) continue;
    if (entry.isDirectory()) await walk(full, results, excludeRules, baseRoot);
    else if (entry.isFile() && classifyKind(entry.name)) { results.files.push(full); results.discovered += 1; }
  }
}
async function doScanAssets() {
  scanSnapshot = {
    assets: assets.map(asset => ({ ...asset, tags: Array.isArray(asset.tags) ? [...asset.tags] : asset.tags, parameters: asset.parameters && typeof asset.parameters === 'object' ? { ...asset.parameters } : asset.parameters })),
    prompts: prompts.map(prompt => ({ ...prompt, tags: Array.isArray(prompt.tags) ? [...prompt.tags] : prompt.tags })),
  };
  scanState = { status: 'running', scannedAt: null, startedAt: new Date().toISOString(), finishedAt: null, added: 0, updated: 0, removed: 0, errors: [], discovered: 0, processed: 0, total: 0, percent: 0, currentRoot: null, currentPath: null };
  const roots = configuredRoots();
  const config = loadConfig();
  const results = { files: [], errors: [], discovered: 0 };
  const rootState = new Map();
  for (const root of (config.sourceRoots || config.projects || [])) {
    const resolved = { ...root, root: path.resolve(root.root) };
    let available = false;
    try { available = resolved.enabled !== false && fs.statSync(resolved.root).isDirectory(); } catch {}
    rootState.set(String(resolved.id), { ...resolved, available });
  }
  for (const root of roots) {
    scanState.currentRoot = root.id;
    await walk(root.root, results, Array.isArray(root.excludeRules) ? root.excludeRules : [], root.root);
    scanState.discovered = results.discovered;
  }
  scanState.total = results.files.length;
  const byPath = new Map(assets.map(asset => [path.normalize(asset.path).toLowerCase(), asset]));
  const byHash = new Map(assets.filter(asset => asset.contentHash).map(asset => [asset.contentHash, asset]));
  const seen = new Set(); const seenIds = new Set(); const assetIndexById = new Map(assets.map((asset, index) => [asset.id, index]));
  for (const file of results.files) {
    if (scanCancelRequested) throw Object.assign(new Error('Scan cancelled'), { code: 'SCAN_CANCELLED' });
    const key = path.normalize(file).toLowerCase();
    seen.add(key);
    const project = projectForFile(file, roots);
    scanState.currentPath = file;
    try {
      const stat = await fsp.stat(file);
      let prior = byPath.get(key);
      let contentHash = prior?.contentHash || null;
      if (!prior) {
        contentHash = await hashFile(file);
        const moved = byHash.get(contentHash);
        if (moved && moved.size === stat.size && !seenIds.has(moved.id)) prior = moved;
      }
      const unchanged = prior && prior.size === stat.size && prior.mtimeMs === stat.mtimeMs;
      const sidecar = parseSidecar(file) || {};
      const kind = classifyKind(file);
      const next = {
        ...(prior || {}),
        id: prior?.id || id('asset', file),
        name: path.basename(file), path: file,
        relativePath: project ? path.relative(project.root, file) : path.basename(file),
        projectId: text(sidecar.projectId) || project?.id || 'workspace',
        projectName: text(sidecar.projectName) || project?.name || '工作区',
        sourceRootId: project?.id || null,
        availability: 'available',
        kind, size: stat.size, mtimeMs: stat.mtimeMs,
        updatedAt: new Date().toISOString(),
        group: text(sidecar.group) || prior?.group || inferGroup(sidecar, file, kind),
        reviewStatus: text(sidecar.reviewStatus || sidecar.status) || prior?.reviewStatus || 'needs-review',
        tags: Array.isArray(sidecar.tags) ? sidecar.tags : (prior?.tags || []),
        favorite: Boolean(prior?.favorite || sidecar.favorite),
        promptId: text(sidecar.promptId) || prior?.promptId || null,
        generationId: text(sidecar.generationId) || prior?.generationId || null,
        prompt: text(sidecar.prompt) || prior?.prompt || '',
        negativePrompt: text(sidecar.negativePrompt) || prior?.negativePrompt || '',
        provider: text(sidecar.provider) || prior?.provider || '',
        model: text(sidecar.model) || prior?.model || '',
        mode: text(sidecar.mode || sidecar.generationMode) || prior?.mode || '',
        parameters: sidecar.parameters && typeof sidecar.parameters === 'object' ? sidecar.parameters : (prior?.parameters || {}),
      };
      if (!unchanged || !prior?.contentHash) next.contentHash = contentHash || await hashFile(file);
      if (kind === 'image') { next.width = sidecar.width || prior?.width || null; next.height = sidecar.height || prior?.height || null; }
      if (kind === 'video' || kind === 'music') next.duration = sidecar.duration || prior?.duration || null;
      if (prior) { assets[assetIndexById.get(prior.id)] = next; seenIds.add(prior.id); scanState.updated += 1; }
      else { assets.push(next); assetIndexById.set(next.id, assets.length - 1); seenIds.add(next.id); scanState.added += 1; }
      if (next.prompt && !next.promptId) {
        const promptId = id('prompt', `${next.prompt}\n${next.negativePrompt}`);
        next.promptId = promptId;
        if (!prompts.some(prompt => prompt.id === promptId)) prompts.push({ id: promptId, title: `${next.name} 提示词`, content: next.prompt, negativePrompt: next.negativePrompt, type: `${kind}-prompt`, tags: next.tags, model: next.model, provider: next.provider, version: 1, createdAt: next.updatedAt, updatedAt: next.updatedAt });
      }
    } catch (error) { results.errors.push(`${file}: ${error.message}`); }
    scanState.processed += 1;
    scanState.percent = scanState.total ? Math.round((scanState.processed / scanState.total) * 100) : 100;
  }
  scanState.removed = 0;
  for (const asset of assets) {
    const source = rootState.get(String(asset.sourceRootId || asset.projectId));
    if (source && source.enabled === false) {
      asset.missing = false;
      asset.availability = 'source-disabled';
    } else if (source && !source.available) {
      asset.missing = false;
      asset.availability = 'source-offline';
    } else if (seenIds.has(asset.id)) {
      asset.missing = false;
      asset.availability = 'available';
    } else {
      asset.missing = true;
      asset.availability = 'missing';
    }
    if (asset.missing && !asset.missingAt) asset.missingAt = new Date().toISOString();
    if (!asset.missing) asset.missingAt = null;
  }
  scanState.scannedAt = new Date().toISOString();
  for (const root of config.sourceRoots || config.projects || []) {
    if (!root || !root.id) continue;
    const indexed = assets.filter(asset => asset.sourceRootId === root.id || asset.projectId === root.id);
    root.lastScanAt = scanState.scannedAt;
    root.indexedCount = indexed.filter(asset => asset.availability !== 'missing').length;
    root.missingCount = indexed.filter(asset => asset.availability === 'missing').length;
    root.available = fs.existsSync(root.root);
  }
  if (Array.isArray(config.sourceRoots)) await atomicJsonWrite(CONFIG_PATH, config);
  scanState.errors = results.errors.slice(0, 50);
  scanState.status = 'idle';
  scanState.finishedAt = new Date().toISOString();
  scanState.currentRoot = null;
  scanState.currentPath = null;
  await atomicJsonWrite(ASSET_INDEX_PATH, assets);
  await atomicJsonWrite(PROMPT_INDEX_PATH, prompts);
  persistLibrary();
  appendEvent({ type: 'scan', ...scanState });
  return scanState;
}
function scanAssets() {
  if (activeScan) return activeScan;
  scanCancelRequested = false;
  activeScan = doScanAssets().catch(error => {
    if (error.code === 'SCAN_CANCELLED') {
      // Cancellation must leave the persisted index exactly as it was before the run.
      if (scanSnapshot) { assets = scanSnapshot.assets; prompts = scanSnapshot.prompts; library.assets = assets; library.prompts = prompts; }
    }
    scanState.status = error.code === 'SCAN_CANCELLED' ? 'cancelled' : 'error';
    scanState.error = error.message;
    scanState.finishedAt = new Date().toISOString();
    appendEvent({ type: 'scan-failed', ...scanState });
    return scanState;
  }).finally(() => { activeScan = null; scanSnapshot = null; });
  return activeScan;
}
function cancelScan() { if (!activeScan) return false; scanCancelRequested = true; return true; }
function appendEvent(event) {
  try { fs.mkdirSync(path.dirname(EVENT_LOG_PATH), { recursive: true }); fs.appendFileSync(EVENT_LOG_PATH, `${JSON.stringify({ ...event, at: new Date().toISOString() })}\n`); } catch {}
}
function tokenAuthorized(req) {
  const expected = text(jsonRead(TOKEN_PATH, '') || (() => { try { return fs.readFileSync(TOKEN_PATH, 'utf8'); } catch { return ''; } })());
  return expected.length >= 16 && text(req.headers['x-asset-console-token']) === expected;
}
function pickFolder() {
  if (process.platform !== 'win32') return Promise.resolve(null);
  return new Promise((resolve) => {
    const script = "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = '选择资产库来源文件夹'; $dialog.ShowNewFolderButton = $true; if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $dialog.SelectedPath }";
    execFile('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { windowsHide: false, timeout: 120000 }, (error, stdout) => {
      if (error) return resolve(null);
      const selected = text(stdout).replace(/[\r\n]+/g, '');
      resolve(selected || null);
    });
  });
}
function send(res, status, payload, type = 'application/json; charset=utf-8', extra = {}) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(body);
}
async function body(req) {
  let value = ''; for await (const chunk of req) { value += chunk; if (value.length > 512 * 1024) throw new Error('Request body too large'); }
  try { return JSON.parse(value || '{}'); } catch { throw new Error('Invalid JSON'); }
}
function assetById(value) { return assets.find(asset => asset.id === value) || null; }
function filteredAssets(url) {
  const q = text(url.searchParams.get('q')).toLowerCase();
  const filters = {
    projectId: text(url.searchParams.get('projectId')), kind: text(url.searchParams.get('kind')),
    group: text(url.searchParams.get('group')), tag: text(url.searchParams.get('tag')), collectionId: text(url.searchParams.get('collectionId')),
    availability: text(url.searchParams.get('availability')), favorite: text(url.searchParams.get('favorite')),
  };
  const collection = filters.collectionId ? collections.find(item => item.id === filters.collectionId) : null;
  let list = assets.filter(asset => (!filters.projectId || asset.projectId === filters.projectId || asset.sourceRootId === filters.projectId) && (!filters.kind || asset.kind === filters.kind) && (!filters.group || asset.group === filters.group) && (!filters.tag || (asset.tags || []).includes(filters.tag)) && (!filters.availability || (asset.availability || (asset.missing ? 'missing' : 'available')) === filters.availability) && (!filters.favorite || asset.favorite === (filters.favorite === 'true')) && (!collection || (collection.assetIds || []).includes(asset.id)) && (!q || `${asset.name} ${asset.path} ${asset.prompt} ${asset.model} ${asset.aiDescription || ''} ${(asset.tags || []).join(' ')} ${(asset.aiTags || []).join(' ')}`.toLowerCase().includes(q)));
  const sort = url.searchParams.get('sort') || 'updated';
  list.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'zh-CN') : (b.mtimeMs || 0) - (a.mtimeMs || 0));
  return list;
}
async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  if (url.pathname === '/api/health') return send(res, 200, { ok: true, port: PORT, generatedAt: new Date().toISOString() });
  if (url.pathname === '/api/config' && req.method === 'GET') {
    const config = loadConfig();
    return send(res, 200, { ...config, projects: config.projects, sourceRoots: allSourceRoots(), dbPath: library.dbPath, assetCount: assets.length, promptCount: prompts.length, generationCount: generations.length, scan: scanState });
  }
  if (url.pathname === '/api/source-roots' && req.method === 'GET') return send(res, 200, { items: allSourceRoots() });
  if (url.pathname === '/api/source-roots/pick-folder' && req.method === 'POST') {
    if (!tokenAuthorized(req)) return send(res, 401, { error: 'Unauthorized' });
    const root = await pickFolder();
    if (!root) return send(res, 200, { cancelled: true, root: '' });
    if (!path.isAbsolute(root) || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) return send(res, 400, { error: 'Folder does not exist' });
    return send(res, 200, { cancelled: false, root: path.resolve(root), name: path.basename(root) || root });
  }
  if ((url.pathname === '/api/source-roots' || url.pathname === '/api/projects') && req.method === 'POST') {
    if (!tokenAuthorized(req)) return send(res, 401, { error: 'Unauthorized' });
    const data = await body(req); const root = path.resolve(text(data.root));
    if (!path.isAbsolute(root) || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) return send(res, 400, { error: 'Folder does not exist' });
    if (root === path.parse(root).root || safeInside(root, STATE_ROOT) || safeInside(root, ROOT)) return send(res, 400, { error: 'This folder cannot be used as a source root' });
    const config = loadConfig(); const sourceRoot = { id: text(data.id) || id('source', root), name: text(data.name) || path.basename(root), root, enabled: data.enabled !== false, watchEnabled: data.watchEnabled === true, excludeRules: Array.isArray(data.excludeRules) ? data.excludeRules.map(text).filter(Boolean).slice(0, 50) : [], lastScanAt: null };
    config.sourceRoots = [sourceRoot, ...(config.sourceRoots || []).filter(item => item.id !== sourceRoot.id && path.resolve(item.root) !== root)];
    config.projects = config.sourceRoots.map(({ watchEnabled, excludeRules, ...project }) => project);
    await atomicJsonWrite(CONFIG_PATH, config); persistLibrary(); return send(res, 201, sourceRoot);
  }
  const sourceRootMatch = /^\/api\/(?:source-roots|projects)\/([^/]+)$/.exec(url.pathname);
  if (sourceRootMatch && req.method === 'PATCH') {
    if (!tokenAuthorized(req)) return send(res, 401, { error: 'Unauthorized' });
    const data = await body(req); const config = loadConfig(); const index = (config.sourceRoots || []).findIndex(item => item.id === sourceRootMatch[1]);
    if (index < 0) return send(res, 404, { error: 'Source root not found' });
    const current = config.sourceRoots[index];
    for (const key of ['name', 'enabled', 'watchEnabled']) if (data[key] !== undefined) current[key] = data[key];
    if (Array.isArray(data.excludeRules)) current.excludeRules = data.excludeRules.map(text).filter(Boolean).slice(0, 50);
    config.projects = config.sourceRoots.map(({ watchEnabled, excludeRules, ...project }) => project);
    await atomicJsonWrite(CONFIG_PATH, config); persistLibrary(); return send(res, 200, allSourceRoots().find(item => item.id === current.id));
  }
  if (sourceRootMatch && req.method === 'DELETE') {
    if (!tokenAuthorized(req)) return send(res, 401, { error: 'Unauthorized' });
    const config = loadConfig(); config.sourceRoots = (config.sourceRoots || []).filter(item => item.id !== sourceRootMatch[1]); config.projects = config.sourceRoots.map(({ watchEnabled, excludeRules, ...project }) => project); await atomicJsonWrite(CONFIG_PATH, config); persistLibrary(); return send(res, 200, { ok: true });
  }
  if (url.pathname === '/api/scan' && req.method === 'POST') {
    if (!tokenAuthorized(req)) return send(res, 401, { error: 'Unauthorized' });
    if (activeScan) return send(res, 202, { ...scanState, started: false });
    scanAssets();
    return send(res, 202, { ...scanState, started: true });
  }
  if (url.pathname === '/api/scan/status' && req.method === 'GET') return send(res, 200, scanState);
  if (url.pathname === '/api/scan/cancel' && req.method === 'POST') {
    if (!tokenAuthorized(req)) return send(res, 401, { error: 'Unauthorized' });
    if (!cancelScan()) return send(res, 409, { ...scanState, error: 'No scan is running' });
    return send(res, 202, { ...scanState, cancelRequested: true });
  }
  if (url.pathname === '/api/assets' && req.method === 'GET') {
    const list = filteredAssets(url); const page = Math.max(1, Number(url.searchParams.get('page') || 1)); const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('pageSize') || 80))); const start = (page - 1) * pageSize;
    const facets = { kinds: {}, groups: {}, tags: {} }; for (const item of list) { facets.kinds[item.kind] = (facets.kinds[item.kind] || 0) + 1; facets.groups[item.group] = (facets.groups[item.group] || 0) + 1; for (const tag of item.tags || []) facets.tags[tag] = (facets.tags[tag] || 0) + 1; }
    return send(res, 200, { items: list.slice(start, start + pageSize), total: list.length, page, pageSize, facets, scan: scanState });
  }
  if (url.pathname === '/api/assets/bulk' && req.method === 'PATCH') {
    if (!tokenAuthorized(req)) return send(res, 401, { error: 'Unauthorized' });
    const data = await body(req);
    const ids = Array.isArray(data.assetIds) ? [...new Set(data.assetIds.map(text).filter(Boolean))].slice(0, 500) : [];
    const patch = data.patch && typeof data.patch === 'object' && !Array.isArray(data.patch) ? data.patch : {};
    const allowed = ['group', 'reviewStatus', 'projectId', 'projectName', 'favorite', 'prompt', 'negativePrompt', 'promptId', 'generationId', 'provider', 'model', 'mode', 'userNotes', 'aiDescription', 'aiTags', 'rating'];
    const now = new Date().toISOString(); const selected = [];
    for (const asset of assets) {
      if (!ids.includes(asset.id)) continue;
      for (const key of allowed) if (patch[key] !== undefined) asset[key] = patch[key];
      if (Array.isArray(patch.tags)) asset.tags = patch.tags.map(text).filter(Boolean).slice(0, 50);
      asset.updatedAt = now; selected.push(asset);
      appendEvent({ type: 'asset-update', assetId: asset.id, patch });
    }
    if (selected.length) { await atomicJsonWrite(ASSET_INDEX_PATH, assets); persistLibrary(); }
    return send(res, 200, { updated: selected.length, items: selected });
  }
  const assetMatch = /^\/api\/assets\/([^/]+)$/.exec(url.pathname);
  if (assetMatch && req.method === 'GET') { const asset = assetById(assetMatch[1]); return asset ? send(res, 200, asset) : send(res, 404, { error: 'Asset not found' }); }
  const previewMatch = /^\/api\/assets\/([^/]+)\/preview$/.exec(url.pathname);
  if (previewMatch && req.method === 'GET') {
    const asset = assetById(previewMatch[1]);
    if (!asset) return send(res, 404, { error: 'Asset not found' });
    return send(res, 302, '', 'text/plain; charset=utf-8', { Location: `/media?id=${encodeURIComponent(asset.id)}` });
  }
  if (assetMatch && req.method === 'PATCH') {
    if (!tokenAuthorized(req)) return send(res, 401, { error: 'Unauthorized' });
    const asset = assetById(assetMatch[1]); if (!asset) return send(res, 404, { error: 'Asset not found' });
    const patch = await body(req); for (const key of ['group', 'reviewStatus', 'projectId', 'projectName', 'favorite', 'prompt', 'negativePrompt', 'promptId', 'generationId', 'provider', 'model', 'mode', 'userNotes', 'aiDescription', 'aiTags', 'rating']) if (patch[key] !== undefined) asset[key] = patch[key]; if (Array.isArray(patch.tags)) asset.tags = patch.tags.map(text).filter(Boolean).slice(0, 50); asset.updatedAt = new Date().toISOString(); await atomicJsonWrite(ASSET_INDEX_PATH, assets); persistLibrary(); appendEvent({ type: 'asset-update', assetId: asset.id, patch }); return send(res, 200, asset);
  }
  if (url.pathname === '/api/prompts' && req.method === 'GET') { const q = text(url.searchParams.get('q')).toLowerCase(); return send(res, 200, { items: prompts.filter(item => !q || `${item.title} ${item.content} ${item.negativePrompt} ${(item.tags || []).join(' ')}`.toLowerCase().includes(q)) }); }
  if (url.pathname === '/api/prompts' && req.method === 'POST') { if (!tokenAuthorized(req)) return send(res, 401, { error: 'Unauthorized' }); const data = await body(req); const now = new Date().toISOString(); const prompt = { id: data.id || id('prompt', `${data.title || ''}${data.content || now}`), title: text(data.title) || '未命名提示词', content: text(data.content), negativePrompt: text(data.negativePrompt), type: text(data.type) || 'general', tags: Array.isArray(data.tags) ? data.tags.map(text).filter(Boolean) : [], provider: text(data.provider), model: text(data.model), version: Number(data.version) || 1, createdAt: now, updatedAt: now }; prompts = [prompt, ...prompts.filter(item => item.id !== prompt.id)]; await atomicJsonWrite(PROMPT_INDEX_PATH, prompts); persistLibrary(); return send(res, 201, prompt); }
  if (url.pathname === '/api/generations' && req.method === 'GET') return send(res, 200, { items: generations });
  if (url.pathname === '/api/generations' && req.method === 'POST') { if (!tokenAuthorized(req)) return send(res, 401, { error: 'Unauthorized' }); const data = await body(req); const now = new Date().toISOString(); const generation = { ...data, id: data.id || id('gen', `${data.model || ''}${data.promptSnapshot || ''}${now}`), createdAt: data.createdAt || now, updatedAt: now }; generations = [generation, ...generations.filter(item => item.id !== generation.id)]; await atomicJsonWrite(GENERATION_INDEX_PATH, generations); persistLibrary(); return send(res, 201, generation); }
  if (url.pathname === '/api/collections' && req.method === 'GET') return send(res, 200, { items: collections.map(item => ({ ...item, assetCount: (item.assetIds || []).length })) });
  if (url.pathname === '/api/collections' && req.method === 'POST') {
    if (!tokenAuthorized(req)) return send(res, 401, { error: 'Unauthorized' });
    const data = await body(req); const now = new Date().toISOString(); const collection = { id: text(data.id) || id('collection', `${data.name || ''}${now}`), name: text(data.name) || '未命名合集', description: text(data.description), assetIds: Array.isArray(data.assetIds) ? data.assetIds.filter(assetId => assetById(assetId)).slice(0, 2000) : [], createdAt: now, updatedAt: now };
    collections = [collection, ...collections.filter(item => item.id !== collection.id)]; persistLibrary(); return send(res, 201, collection);
  }
  const collectionMatch = /^\/api\/collections\/([^/]+)$/.exec(url.pathname);
  if (collectionMatch && req.method === 'PATCH') {
    if (!tokenAuthorized(req)) return send(res, 401, { error: 'Unauthorized' });
    const data = await body(req); const collection = collections.find(item => item.id === collectionMatch[1]); if (!collection) return send(res, 404, { error: 'Collection not found' });
    if (data.name !== undefined) collection.name = text(data.name) || collection.name; if (data.description !== undefined) collection.description = text(data.description); if (Array.isArray(data.assetIds)) collection.assetIds = [...new Set(data.assetIds.filter(assetId => assetById(assetId)))].slice(0, 2000); collection.updatedAt = new Date().toISOString(); persistLibrary(); return send(res, 200, collection);
  }
  if (collectionMatch && req.method === 'DELETE') { if (!tokenAuthorized(req)) return send(res, 401, { error: 'Unauthorized' }); collections = collections.filter(item => item.id !== collectionMatch[1]); persistLibrary(); return send(res, 200, { ok: true }); }
  if (url.pathname === '/api/saved-filters' && req.method === 'GET') return send(res, 200, { items: savedFilters });
  if (url.pathname === '/api/saved-filters' && req.method === 'POST') {
    if (!tokenAuthorized(req)) return send(res, 401, { error: 'Unauthorized' });
    const data = await body(req); const now = new Date().toISOString(); const query = data.query && typeof data.query === 'object' && !Array.isArray(data.query) ? data.query : {};
    const savedFilter = { id: text(data.id) || id('filter', `${data.name || ''}${now}`), name: text(data.name) || '未命名搜索', query, createdAt: now, updatedAt: now }; savedFilters = [savedFilter, ...savedFilters.filter(item => item.id !== savedFilter.id)]; persistLibrary(); return send(res, 201, savedFilter);
  }
  const savedFilterMatch = /^\/api\/saved-filters\/([^/]+)$/.exec(url.pathname);
  if (savedFilterMatch && req.method === 'DELETE') { if (!tokenAuthorized(req)) return send(res, 401, { error: 'Unauthorized' }); savedFilters = savedFilters.filter(item => item.id !== savedFilterMatch[1]); persistLibrary(); return send(res, 200, { ok: true }); }
  if (url.pathname === '/media' && (req.method === 'GET' || req.method === 'HEAD')) {
    const asset = assetById(url.searchParams.get('id')); if (!asset || !asset.path || !safeInside(asset.path, projectRoots().map(item => item.root).find(root => safeInside(asset.path, root)) || '')) return send(res, 404, { error: 'Media not found' });
    return streamFile(req, res, asset);
  }
  const staticPath = url.pathname === '/' ? path.join(PUBLIC_ROOT, 'index.html') : path.join(PUBLIC_ROOT, url.pathname.replace(/^\/+/, ''));
  if (!safeInside(staticPath, PUBLIC_ROOT) || !fs.existsSync(staticPath)) return send(res, 404, { error: 'Not found' });
  return send(res, 200, fs.readFileSync(staticPath), MIME[path.extname(staticPath).toLowerCase()] || 'application/octet-stream');
}
function streamFile(req, res, asset) {
  let stat; try { stat = fs.statSync(asset.path); } catch { return send(res, 404, { error: 'File not found' }); }
  const type = MIME[path.extname(asset.path).toLowerCase()] || 'application/octet-stream'; const range = req.headers.range; let start = 0; let end = stat.size - 1; let status = 200;
  if (range) { const match = /^bytes=(\d+)-(\d*)$/.exec(range); if (match) { start = Number(match[1]); end = match[2] ? Number(match[2]) : end; end = Math.min(end, stat.size - 1); if (start <= end) status = 206; } }
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1), 'Cache-Control': 'private, max-age=60' }; if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
  res.writeHead(status, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(asset.path, { start, end }).pipe(res);
}

fs.mkdirSync(STATE_ROOT, { recursive: true });
const server = http.createServer((req, res) => { route(req, res).catch(error => send(res, 500, { error: error.message })); });
server.listen(PORT, HOST, () => { loadConfig(); console.log(`AIGC Asset Browser: http://${HOST}:${PORT}`); scanAssets().catch(error => console.error(`Initial scan failed: ${error.message}`)); });
process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
