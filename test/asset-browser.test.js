const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

async function waitFor(url) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { const response = await fetch(url); if (response.ok) return response; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${url}`);
}
async function waitForScan(port) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const status = await (await fetch(`http://127.0.0.1:${port}/api/scan/status`)).json();
    if (['idle', 'cancelled', 'error'].includes(status.status)) return status;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Timed out waiting for scan');
}

test('asset browser scans AIGC media and serves safe previews', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aigc-assets-'));
  const fixture = path.join(temp, 'fixture'); const state = path.join(temp, 'state');
  fs.mkdirSync(fixture, { recursive: true });
  fs.writeFileSync(path.join(fixture, 'hero.png'), Buffer.from('fake-png'));
  fs.writeFileSync(path.join(fixture, 'hero.png.aigc.json'), JSON.stringify({ prompt: 'cinematic hospital lobby', provider: 'test', model: 'mock-image', tags: ['场景'] }));
  const config = path.join(state, 'config.json'); fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(config, JSON.stringify({ enabled: true, projects: [{ id: 'test', name: '测试项目', root: fixture, enabled: true }] }));
  const token = 'asset-browser-test-token-1234567890';
  fs.writeFileSync(path.join(state, 'token'), token);
  const port = 5200 + Math.floor(Math.random() * 200);
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'asset-browser', 'server.js')], { env: { ...process.env, ASSET_BROWSER_PORT: String(port), ASSET_BROWSER_STATE_ROOT: state, ASSET_BROWSER_CONFIG: config, ASSET_BROWSER_TOKEN_FILE: path.join(state, 'token') }, stdio: 'ignore' });
  try {
    await waitFor(`http://127.0.0.1:${port}/api/health`);
    const unauthorized = await fetch(`http://127.0.0.1:${port}/api/scan`, { method: 'POST' });
    assert.equal(unauthorized.status, 401);
    const unauthorizedPicker = await fetch(`http://127.0.0.1:${port}/api/source-roots/pick-folder`, { method: 'POST' });
    assert.equal(unauthorizedPicker.status, 401);
    const authHeaders = { 'x-asset-console-token': token, 'content-type': 'application/json' };
    const scanResponse = await fetch(`http://127.0.0.1:${port}/api/scan`, { method: 'POST', headers: authHeaders });
    assert.equal(scanResponse.status, 202);
    const scan = await scanResponse.json();
    assert.equal(scan.status, 'running');
    assert.equal((await waitForScan(port)).status, 'idle');
    const payload = await (await fetch(`http://127.0.0.1:${port}/api/assets`)).json();
    const image = payload.items.find(item => item.kind === 'image');
    assert.equal(image.prompt, 'cinematic hospital lobby');
    assert.equal(payload.facets.kinds.image, 1);
    assert.equal(payload.facets.tags['场景'], 1);
    assert.equal((await (await fetch(`http://127.0.0.1:${port}/api/assets?favorite=true`)).json()).total, 0);
    const bulkUnauthorized = await fetch(`http://127.0.0.1:${port}/api/assets/bulk`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assetIds: [image.id], patch: { favorite: true } }) });
    assert.equal(bulkUnauthorized.status, 401);
    const bulk = await fetch(`http://127.0.0.1:${port}/api/assets/bulk`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ assetIds: [image.id], patch: { favorite: true, group: 'official' } }) });
    assert.equal(bulk.status, 200);
    assert.equal((await bulk.json()).updated, 1);
    const updatedImage = (await (await fetch(`http://127.0.0.1:${port}/api/assets/${image.id}`)).json());
    assert.equal(updatedImage.favorite, true);
    assert.equal(updatedImage.group, 'official');
    const head = await fetch(`http://127.0.0.1:${port}/media?id=${image.id}`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('accept-ranges'), 'bytes');
    const roots = await (await fetch(`http://127.0.0.1:${port}/api/source-roots`)).json();
    assert.equal(roots.items[0].status, 'online');
    const collectionResponse = await fetch(`http://127.0.0.1:${port}/api/collections`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: '首批', assetIds: [image.id] }) });
    assert.equal(collectionResponse.status, 201);
    const collection = await collectionResponse.json();
    assert.equal(collection.assetIds[0], image.id);
    const filtered = await (await fetch(`http://127.0.0.1:${port}/api/assets?collectionId=${collection.id}`)).json();
    assert.equal(filtered.total, 1);
    const saved = await fetch(`http://127.0.0.1:${port}/api/saved-filters`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: '图片', query: { kind: 'image' } }) });
    assert.equal(saved.status, 201);

    fs.renameSync(path.join(fixture, 'hero.png'), path.join(fixture, 'hero-moved.png'));
    const movedScan = await fetch(`http://127.0.0.1:${port}/api/scan`, { method: 'POST', headers: authHeaders });
    assert.equal(movedScan.status, 202);
    assert.equal((await waitForScan(port)).status, 'idle');
    const moved = await (await fetch(`http://127.0.0.1:${port}/api/assets`)).json();
    assert.equal(moved.items.find(item => item.name === 'hero-moved.png').id, image.id);

    const excluded = path.join(fixture, 'excluded'); fs.mkdirSync(excluded); fs.writeFileSync(path.join(excluded, 'skip.png'), Buffer.from('skip'));
    const configData = JSON.parse(fs.readFileSync(config, 'utf8'));
    configData.sourceRoots = [{ ...configData.projects[0], excludeRules: ['excluded'] }];
    fs.writeFileSync(config, JSON.stringify(configData));
    await fetch(`http://127.0.0.1:${port}/api/scan`, { method: 'POST', headers: authHeaders });
    await waitForScan(port);
    const withoutExcluded = await (await fetch(`http://127.0.0.1:${port}/api/assets`)).json();
    assert.equal(withoutExcluded.items.some(item => item.name === 'skip.png'), false);

    fs.renameSync(fixture, `${fixture}-offline`);
    await fetch(`http://127.0.0.1:${port}/api/scan`, { method: 'POST', headers: authHeaders });
    await waitForScan(port);
    const offlineRoots = await (await fetch(`http://127.0.0.1:${port}/api/source-roots`)).json();
    assert.equal(offlineRoots.items[0].status, 'offline');
    const retained = await (await fetch(`http://127.0.0.1:${port}/api/assets`)).json();
    assert.equal(retained.items.some(item => item.id === image.id), true);
    assert.equal(fs.existsSync(path.join(state, 'asset-library.sqlite')), true);
  } finally {
    child.kill();
    try { fs.rmSync(temp, { recursive: true, force: true }); } catch {}
  }
});
