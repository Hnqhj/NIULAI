const params = new URLSearchParams(window.location.search);
const initialTheme = params.get('theme');
if (initialTheme === 'light' || initialTheme === 'dark') document.documentElement.dataset.theme = initialTheme;

const state = {
  skills: [], query: '', filter: '全部', favorites: new Set(), updated: '',
  overview: null, monitorTimer: null, monitorStream: null, selectedRunId: '', skillsError: false, overviewError: false,
  view: 'manage', transitionToken: 0, detailSkill: null, detailOpener: null, detailEnabled: true,
  monitorCanvas: { x: 0, y: 0, scale: 1, graphKey: '' }, monitorProject: null, monitorTaskQuery: '', monitorFilterActive: false, selectedConversationId: '',
};
const FAVORITES_KEY = 'skill-console:skill-favorites-v2';
const CATEGORY_ORDER = ['镜头', '动作', '特效', '表演', '连续性', '平台与提示词', '质量与迭代', '美术与材质', '其他'];
const $ = (id) => document.getElementById(id);

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (raw) state.favorites = new Set(JSON.parse(raw).filter((value) => typeof value === 'string'));
  } catch {}
}
function saveFavorites() { try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites])); } catch {} }
function normalized(value) { return String(value || '').toLocaleLowerCase('zh-CN'); }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', withTime ? {} : { year: 'numeric', month: '2-digit', day: '2-digit' });
}
const SKILL_ICONS = {
  '镜头': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7h12a2 2 0 0 1 2 2v8H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" stroke-width="1.6"/><path d="m17 11 4-2v7l-4-2M7 4l2 3m3-3 2 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  '动作': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  '特效': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 20 10-10M12 4l.7 2.3L15 7l-2.3.7L12 10l-.7-2.3L9 7l2.3-.7L12 4Zm6 7 .8 2.2L21 14l-2.2.8L18 17l-.8-2.2L15 14l2.2-.8L18 11Z" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/><path d="m3 17 4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  '表演': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4h14v7c0 5-3.1 8-7 9-3.9-1-7-4-7-9V4Z" stroke="currentColor" stroke-width="1.6"/><path d="M8 9h.01M16 9h.01M9 14c1.8 1.3 4.2 1.3 6 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  '连续性': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.5 14.5 14.5 9M7.4 17.6l-1 1a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0M16.6 6.4l1-1a3.5 3.5 0 1 1 5 5l-3 3a3.5 3.5 0 0 1-5 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  '平台与提示词': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" stroke-width="1.6"/><path d="m7 9 3 3-3 3m6 0h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  '质量与迭代': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.6 8 7 10 4.4-2 7-5.5 7-10V6l-7-3Z" stroke="currentColor" stroke-width="1.6"/><path d="m8.5 12 2.2 2.2 4.8-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  '美术与材质': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18h1.3a1.7 1.7 0 0 0 1.2-2.9 1.7 1.7 0 0 1 1.2-2.9H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z" stroke="currentColor" stroke-width="1.6"/><path d="M7.5 10h.01M10 6.8h.01M14.2 6.8h.01M17 10h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  '其他': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.2" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="4" width="6" height="6" rx="1.2" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="14" width="6" height="6" rx="1.2" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="14" width="6" height="6" rx="1.2" stroke="currentColor" stroke-width="1.6"/></svg>',
};
function skillIcon(category) { return SKILL_ICONS[category] || SKILL_ICONS['其他']; }
function skillLabel(skill) { return skill?.displayName || skill?.name || '未命名技能'; }
function favoriteIcon(active) { return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 17.03l-5.5 2.89 1.05-6.12L3.1 9.47l6.15-.9L12 3Z" fill="${active ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`; }

function updateSkillDetailFavorite() {
  const skill = state.detailSkill;
  const button = $('skill-detail-favorite');
  if (!skill || !button) return;
  const active = state.favorites.has(skill.name);
  button.classList.toggle('is-favorite', active);
  button.setAttribute('aria-pressed', String(active));
  button.innerHTML = `${favoriteIcon(active)}<span>${active ? '已加入常用' : '加入常用'}</span>`;
}

function openSkillDetail(skill, opener) {
  const dialog = $('skill-detail-dialog');
  if (!dialog || !skill) return;
  state.detailSkill = skill;
  state.detailEnabled = true;
  state.detailOpener = opener instanceof HTMLElement ? opener : null;
  $('skill-detail-icon').innerHTML = skillIcon(skill.category);
  $('skill-detail-title').textContent = skillLabel(skill);
  $('skill-detail-category').textContent = skill.category || '其他';
  $('skill-detail-description').textContent = skill.description || '已安装技能';
  const dependencies = Array.isArray(skill.mentions) ? skill.mentions.filter(Boolean) : [];
  const dependencySection = $('skill-detail-dependencies');
  dependencySection.hidden = dependencies.length === 0;
  $('skill-detail-dependency-list').replaceChildren(...dependencies.map((name) => {
    const chip = document.createElement('span'); chip.textContent = name; return chip;
  }));
  const references = Array.isArray(skill.references) ? skill.references.filter(Boolean) : [];
  const referenceSection = $('skill-detail-references');
  referenceSection.hidden = references.length === 0;
  $('skill-detail-reference-count').textContent = references.length ? `包含 ${references.length} 份参考资料` : '';
  updateSkillDetailFavorite();
  updateSkillDetailEnabled();
  $('skill-detail-menu')?.setAttribute('hidden', '');
  $('skill-detail-more')?.setAttribute('aria-expanded', 'false');
  // Prepare the in-frame dim layer before entering the browser top layer so
  // Chromium never paints a transient black native dialog backdrop first.
  document.documentElement.classList.add('skill-detail-open');
  // Do not call show()/showModal(): even a non-modal dialog can trigger a
  // browser compositing pass. This is a normal fixed element with dialog
  // semantics retained in the markup.
  dialog.dataset.open = 'true';
  dialog.setAttribute('open', '');
  dialog.setAttribute('aria-hidden', 'false');
  try {
    const r = dialog.getBoundingClientRect();
    window.parent.postMessage({
      source: 'skill-console', action: 'skill-detail-open',
      rect: { x: r.x, y: r.y, width: r.width, height: r.height,
        viewportWidth: window.innerWidth, viewportHeight: window.innerHeight },
    }, '*');
  } catch {}
  $('skill-detail-close')?.focus();
}

function updateSkillDetailEnabled() {
  const button = $('skill-detail-enable');
  if (!button) return;
  button.classList.toggle('is-disabled', !state.detailEnabled);
  button.setAttribute('aria-pressed', String(state.detailEnabled));
  button.setAttribute('aria-label', state.detailEnabled ? '停用技能' : '启用技能');
  button.title = state.detailEnabled ? '停用技能' : '启用技能';
}

async function copyDetailValue(value, button) {
  try { await navigator.clipboard.writeText(value); }
  catch { const area = document.createElement('textarea'); area.value = value; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); }
  const previous = button.textContent;
  button.textContent = '已复制';
  setTimeout(() => { if (button.isConnected) button.textContent = previous; }, 1100);
}

function closeSkillDetail() {
  const dialog = $('skill-detail-dialog');
  if (!dialog || dialog.dataset.open !== 'true') return;
  const opener = state.detailOpener;
  dialog.dataset.open = 'false';
  dialog.removeAttribute('open');
  dialog.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('skill-detail-open');
  state.detailSkill = null; state.detailOpener = null;
  try { window.parent.postMessage({ source: 'skill-console', action: 'skill-detail-close' }, '*'); } catch {}
  opener?.isConnected && opener.focus();
}

function visibleSkills() {
  const query = normalized(state.query);
  return state.skills.filter((skill) => {
    if (state.filter === '常用' && !state.favorites.has(skill.name)) return false;
    if (state.filter !== '全部' && state.filter !== '常用' && skill.category !== state.filter) return false;
    return !query || normalized(`${skillLabel(skill)} ${skill.name} ${skill.description} ${skill.category} ${skill.filePath}`).includes(query);
  });
}
function renderSkillFilters() {
  const available = new Set(state.skills.map((skill) => skill.category).filter(Boolean));
  const names = ['全部', '常用', ...CATEGORY_ORDER.filter((name) => available.has(name)), ...[...available].filter((name) => !CATEGORY_ORDER.includes(name)).sort((a, b) => a.localeCompare(b, 'zh-CN'))];
  const filters = $('skill-filters');
  const signature = JSON.stringify(names);
  if (filters.dataset.signature === signature) {
    filters.querySelectorAll('.skill-filter').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === state.filter)));
    return;
  }
  const previousScrollLeft = filters.scrollLeft;
  filters.replaceChildren(...names.map((name) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'skill-filter'; button.textContent = name; button.dataset.filter = name;
    button.setAttribute('aria-pressed', String(name === state.filter));
    button.onclick = () => { state.filter = name; renderManage(); };
    return button;
  }));
  filters.dataset.signature = signature;
  filters.scrollLeft = previousScrollLeft;
}

function renderManage() {
  renderSkillFilters();
  const skills = visibleSkills();
  $('skill-count').textContent = `${state.skills.length} 个`;
  $('skill-updated').textContent = state.updated ? `更新于 ${formatDate(state.updated, true)}` : '';
  const list = $('skill-list'); list.replaceChildren();
  if (!skills.length) {
    const empty = document.createElement('div'); empty.className = 'skill-empty';
    const message = document.createElement('p');
    message.textContent = state.skillsError ? '技能目录暂时无法读取' : state.skills.length ? '没有匹配的技能' : '技能目录为空';
    empty.append(message);
    if (state.skillsError) { const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'empty-action'; retry.textContent = '重新加载'; retry.onclick = loadSkills; empty.append(retry); }
    list.append(empty); return;
  }
  const grouped = new Map();
  for (const skill of skills) { const category = skill.category || '其他'; if (!grouped.has(category)) grouped.set(category, []); grouped.get(category).push(skill); }
  const categories = [...grouped.keys()].sort((a, b) => (CATEGORY_ORDER.indexOf(a) < 0 ? 99 : CATEGORY_ORDER.indexOf(a)) - (CATEGORY_ORDER.indexOf(b) < 0 ? 99 : CATEGORY_ORDER.indexOf(b)) || a.localeCompare(b, 'zh-CN'));
  for (const category of categories) {
    const section = document.createElement('section'); section.className = 'skill-group'; section.dataset.category = category;
    const heading = document.createElement('div'); heading.className = 'skill-group-heading'; heading.innerHTML = `<h2>${esc(category)}</h2><span>${grouped.get(category).length}</span>`;
    const grid = document.createElement('div'); grid.className = 'skill-grid';
    for (const skill of grouped.get(category)) {
      const row = document.createElement('article'); row.className = 'skill-item'; row.dataset.category = category;
      row.tabIndex = 0; row.setAttribute('role', 'button'); row.setAttribute('aria-label', `查看 ${skillLabel(skill)} 的详情`);
      const icon = document.createElement('span'); icon.className = 'skill-item-icon'; icon.innerHTML = skillIcon(category);
      const body = document.createElement('div'); body.className = 'skill-item-body';
      body.innerHTML = `<h3>${esc(skillLabel(skill))}</h3><p>${esc(skill.shortDescription || skill.description || '已安装技能')}</p>`;
      const actions = document.createElement('div'); actions.className = 'skill-item-actions';
      const active = state.favorites.has(skill.name);
      const favorite = document.createElement('button'); favorite.type = 'button'; favorite.className = `icon-button${active ? ' is-favorite' : ''}`; favorite.setAttribute('aria-label', active ? '移出常用' : '加入常用'); favorite.title = active ? '移出常用' : '加入常用'; favorite.innerHTML = favoriteIcon(active);
      favorite.onclick = (event) => {
        event.stopPropagation();
        state.favorites.has(skill.name) ? state.favorites.delete(skill.name) : state.favorites.add(skill.name);
        saveFavorites(); renderManage(); updateSkillDetailFavorite();
      };
      actions.append(favorite);
      row.addEventListener('click', () => openSkillDetail(skill, row));
      row.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault(); openSkillDetail(skill, row);
      });
      row.append(icon, body, actions); grid.append(row);
    }
    section.append(heading, grid); list.append(section);
  }
}


async function loadSkills() {
  const list = $('skill-list'); list?.setAttribute('aria-busy', 'true'); state.skillsError = false;
  try { const response = await fetch('/api/skills', { cache: 'no-store' }); if (!response.ok) throw new Error(`HTTP ${response.status}`); const data = await response.json(); state.skills = Array.isArray(data.skills) ? data.skills : []; state.updated = data.generatedAt || ''; }
  catch { state.skills = []; state.skillsError = true; }
  loadFavorites(); renderManage(); list?.setAttribute('aria-busy', 'false');
}
async function loadOverview() { state.overviewError = false; try { const response = await fetch('/api/overview?refresh=1', { cache: 'no-store' }); if (!response.ok) throw new Error(`HTTP ${response.status}`); const next = await response.json(); const hasSelection = (next.runs || []).some((run) => run.runId === state.selectedRunId); if (!state.monitorFilterActive && (!state.selectedRunId || !hasSelection)) state.selectedRunId = next.currentRun?.runId || next.runs?.[0]?.runId || ''; else if (state.selectedRunId && !hasSelection) state.selectedRunId = ''; state.overview = next; } catch { state.overview = null; state.overviewError = true; } renderMonitor(); }
function setMonitorConnection(stateName, label) { const el = $('monitor-connection'); if (!el) return; el.dataset.state = stateName; el.querySelector('span').textContent = label; }
function disconnectMonitorStream() { state.monitorStream?.close(); state.monitorStream = null; }

document.querySelectorAll('[data-workspace-view]').forEach((button) => button.addEventListener('click', () => switchWorkspace(button.dataset.workspaceView)));
document.querySelectorAll('[data-workspace-view]').forEach((button, index, buttons) => button.addEventListener('keydown', (event) => { if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length; buttons[next].focus(); buttons[next].click(); }));
document.querySelector('#monitor-refresh-button')?.addEventListener('click', () => { const button = $('#monitor-refresh-button'); button.disabled = true; Promise.resolve(loadOverview()).finally(() => { button.disabled = false; }); });
document.querySelector('#skill-search')?.addEventListener('input', (event) => { state.query = event.target.value; renderManage(); });
$('skill-detail-close')?.addEventListener('click', closeSkillDetail);
$('skill-detail-dialog')?.addEventListener('click', (event) => { if (event.target === event.currentTarget) closeSkillDetail(); });
$('skill-detail-dialog')?.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); closeSkillDetail(); } });
document.addEventListener('click', (event) => {
  const dialog = $('skill-detail-dialog');
  if (state.detailSkill && dialog?.open && !dialog.contains(event.target)) closeSkillDetail();
}, true);
$('skill-detail-dialog')?.addEventListener('close', () => {
  const opener = state.detailOpener; state.detailSkill = null; state.detailOpener = null;
  document.documentElement.classList.remove('skill-detail-open');
  try { window.parent.postMessage({ source: 'skill-console', action: 'skill-detail-close' }, '*'); } catch {}
  opener?.isConnected && opener.focus();
});
$('skill-detail-favorite')?.addEventListener('click', () => {
  const skill = state.detailSkill; if (!skill) return;
  state.favorites.has(skill.name) ? state.favorites.delete(skill.name) : state.favorites.add(skill.name);
  saveFavorites(); updateSkillDetailFavorite(); renderManage();
});
$('skill-detail-enable')?.addEventListener('click', () => { state.detailEnabled = !state.detailEnabled; updateSkillDetailEnabled(); });
$('skill-detail-more')?.addEventListener('click', () => {
  const menu = $('skill-detail-menu'); const button = $('skill-detail-more'); if (!menu || !button) return;
  const open = menu.hidden; menu.hidden = !open; button.setAttribute('aria-expanded', String(open));
});
$('skill-detail-menu')?.addEventListener('click', (event) => {
  const action = event.target.closest('[data-detail-action]'); const skill = state.detailSkill;
  if (!action || !skill) return;
  const value = action.dataset.detailAction === 'copy-path' ? (skill.filePath || skill.directory || skill.name) : skill.name;
  copyDetailValue(value, action);
});
$('skill-detail-trial')?.addEventListener('click', (event) => {
  const skill = state.detailSkill; if (!skill) return;
  copyDetailValue(`@${skill.name}`, event.currentTarget);
});
document.addEventListener('click', (event) => {
  const menu = $('skill-detail-menu'); const more = $('skill-detail-more');
  if (menu && !menu.hidden && !menu.contains(event.target) && event.target !== more) { menu.hidden = true; more?.setAttribute('aria-expanded', 'false'); }
});

function ensureMonitorDag() {
  const timeline = $('monitor-timeline');
  if (!timeline) return null;
  let dag = $('monitor-dag');
  if (!dag) {
    dag = document.createElement('div');
    dag.id = 'monitor-dag'; dag.className = 'monitor-dag';
    dag.setAttribute('role', 'region'); dag.setAttribute('aria-label', 'Skill 执行画布');
    timeline.parentNode.insertBefore(dag, timeline);
    const meta = document.createElement('div'); meta.className = 'monitor-dag-meta';
    meta.innerHTML = '<span>按观测顺序连接</span><span class="monitor-dag-inference">依赖关系未由 session 明确提供</span>';
    dag.parentNode.insertBefore(meta, dag);
    const heading = document.createElement('div'); heading.className = 'monitor-log-heading';
    heading.innerHTML = '<span class="monitor-section-label">证据</span><h3>完整事件日志</h3>';
    timeline.parentNode.insertBefore(heading, timeline);
  }
  return dag;
}

function renderMonitorInfiniteCanvas(events, run, conversation = null) {
  document.querySelector('.monitor-flow-heading h3')?.replaceChildren(document.createTextNode('Skill 执行画布'));
  const dag = ensureMonitorDag();
  if (!dag) return;
  dag.replaceChildren();
  const skillEvents = events.filter((event) => event.type === 'skill');
  const catalog = Array.isArray(state.skills) ? state.skills : [];
  if (!catalog.length) { dag.innerHTML = '<div class="monitor-dag-empty">技能目录正在加载…</div>'; return; }
  const canvas = document.createElement('div'); canvas.className = 'monitor-dag-canvas'; canvas.setAttribute('role', 'application'); canvas.setAttribute('aria-label', 'Skill 无限画布');
  const toolbar = document.createElement('div'); toolbar.className = 'monitor-dag-toolbar'; toolbar.innerHTML = '<span class="monitor-dag-zoom-label">100%</span><button type="button" data-canvas-action="zoom-out" aria-label="缩小">−</button><button type="button" data-canvas-action="zoom-in" aria-label="放大">+</button><button type="button" data-canvas-action="reset" aria-label="复位视图">↺</button>';
  const viewport = document.createElement('div'); viewport.className = 'monitor-dag-viewport';
  const world = document.createElement('div'); world.className = 'monitor-dag-world';
  const staticEdges = Array.isArray(state.overview?.index?.edges) ? state.overview.index.edges : [];
  const layout = window.SkillWorkflowLayout?.layoutWorkflow(catalog, staticEdges);
  if (!layout) { dag.innerHTML = '<div class="monitor-dag-empty">工作流布局引擎正在加载…</div>'; return; }
  const { positions, routes, sections, width, height, nodeWidth } = layout;
  world.style.width = `${width}px`; world.style.height = `${height}px`;
  const edgeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); edgeLayer.classList.add('monitor-dag-edges'); edgeLayer.setAttribute('aria-hidden', 'true'); edgeLayer.setAttribute('viewBox', `0 0 ${width} ${height}`); edgeLayer.setAttribute('width', width); edgeLayer.setAttribute('height', height);
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker'); marker.id = `monitor-dag-arrow-${Date.now()}`; marker.setAttribute('viewBox', '0 0 8 8'); marker.setAttribute('refX', '7'); marker.setAttribute('refY', '4'); marker.setAttribute('markerWidth', '6'); marker.setAttribute('markerHeight', '6'); marker.setAttribute('orient', 'auto-start-reverse'); const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path'); arrow.setAttribute('d', 'M 0 0 L 8 4 L 0 8 z'); arrow.setAttribute('fill', 'currentColor'); marker.append(arrow); defs.append(marker); edgeLayer.append(defs);
  const latestBySkill = new Map(); skillEvents.forEach((event) => latestBySkill.set(event.skill, event));
  const observedEdges = new Set();
  skillEvents.slice(0, -1).forEach((event, index) => observedEdges.add(`${event.skill}→${skillEvents[index + 1].skill}`));
  const allEdges = [...staticEdges.map((edge) => ({ ...edge, kind: 'reference' })), ...[...observedEdges].map((key) => { const [source, target] = key.split('→'); return { source, target, kind: 'observed' }; })];
  const edgeKeys = new Set();
  allEdges.forEach((edge) => {
    if (edgeKeys.has(`${edge.source}→${edge.target}`)) return; edgeKeys.add(`${edge.source}→${edge.target}`);
    const from = positions.get(edge.source); const to = positions.get(edge.target); if (!from || !to) return;
    const points = routes.get(JSON.stringify([edge.source, edge.target]));
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const startX = from.x + nodeWidth; const startY = from.y + 39; const endX = to.x; const endY = to.y + 39;
    const bend = Math.max(32, Math.abs(endX - startX) * 0.42);
    path.setAttribute('d', points?.length ? SkillWorkflowLayout.routePath(points) : `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`);
    path.classList.add('monitor-dag-path', edge.kind === 'observed' ? 'is-observed' : 'is-reference'); path.style.markerEnd = `url(#${marker.id})`; edgeLayer.append(path);
  });
  world.append(edgeLayer);
  sections.forEach((section, index) => { const label = document.createElement('span'); label.className = 'monitor-dag-layer-label'; label.style.left = '40px'; label.style.top = `${section.y}px`; label.textContent = section.isolated ? '独立技能' : index === 0 ? '主工作流' : `辅助工作流 ${index}`; world.append(label); });
  catalog.forEach((skill, index) => { const point = positions.get(skill.name); if (!point) return; const event = latestBySkill.get(skill.name); const tone = event ? monitorTone(event.status) : 'idle'; const node = document.createElement('button'); node.type = 'button'; node.className = `monitor-dag-node tone-${tone}${event ? ' is-observed' : ''}`; node.style.left = `${point.x}px`; node.style.top = `${point.y}px`; node.dataset.skill = skill.name; node.setAttribute('aria-label', `${skill.name}，${event ? monitorStatus(event.status) : '未在当前对话观测'}`); node.innerHTML = `<span class="monitor-dag-node-index">${String(index + 1).padStart(2, '0')}</span><span class="monitor-dag-node-copy"><strong>${esc(skill.name)}</strong><small>${event ? monitorStatus(event.status) : '未观测'}</small><em>${esc(skill.category || '其他')}</em></span><span class="monitor-dag-node-state" aria-hidden="true"></span>`; node.addEventListener('click', () => { document.querySelectorAll('.monitor-dag-node').forEach((item) => item.classList.remove('is-focused')); node.classList.add('is-focused'); renderInspector(event || { type: 'skill', skill: skill.name, status: 'skipped', label: '当前对话未观测', reason: '该节点属于技能目录或静态引用，当前对话没有明确调用证据。', sourcePath: skill.filePath }, run); }); world.append(node); });
  if (run?.status === 'failed') {
    const alert = document.createElement('div'); alert.className = 'monitor-canvas-alert';
    alert.innerHTML = `<strong>对话失败</strong><span>${esc(run.failureReason || '未提取到明确失败原因')}</span>`;
    canvas.append(alert);
  }
  viewport.append(world); canvas.append(toolbar, viewport); dag.append(canvas);
  const view = state.monitorCanvas; const graphKey = `${run?.runId || 'none'}:${conversation?.conversationId || 'all'}`; const isNewRun = view.graphKey !== graphKey;
  const centerView = () => { view.x = Math.max(18, (viewport.clientWidth - width) / 2); view.y = Math.max(18, (viewport.clientHeight - height) / 2); };
  if (isNewRun) { view.scale = 1; view.graphKey = graphKey; centerView(); }
  const applyTransform = () => { world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`; toolbar.querySelector('.monitor-dag-zoom-label').textContent = `${Math.round(view.scale * 100)}%`; };
  toolbar.addEventListener('click', (event) => { const action = event.target.closest('[data-canvas-action]')?.dataset.canvasAction; if (!action) return; if (action === 'zoom-in') view.scale = Math.min(1.8, view.scale + 0.1); if (action === 'zoom-out') view.scale = Math.max(0.55, view.scale - 0.1); if (action === 'reset') { view.scale = 1; centerView(); } applyTransform(); });
  let dragging = false; let startX = 0; let startY = 0; let originX = 0; let originY = 0;
  viewport.addEventListener('pointerdown', (event) => { if (event.target.closest('.monitor-dag-node')) return; dragging = true; startX = event.clientX; startY = event.clientY; originX = view.x; originY = view.y; viewport.setPointerCapture(event.pointerId); viewport.classList.add('is-panning'); });
  viewport.addEventListener('pointermove', (event) => { if (!dragging) return; view.x = originX + event.clientX - startX; view.y = originY + event.clientY - startY; applyTransform(); });
  viewport.addEventListener('pointerup', (event) => { dragging = false; viewport.releasePointerCapture?.(event.pointerId); viewport.classList.remove('is-panning'); });
  viewport.addEventListener('pointercancel', () => { dragging = false; viewport.classList.remove('is-panning'); });
  viewport.addEventListener('wheel', (event) => { event.preventDefault(); view.scale = Math.max(0.55, Math.min(1.8, view.scale * (event.deltaY < 0 ? 1.08 : 0.92))); applyTransform(); }, { passive: false });
  applyTransform();
}

// The monitor reads explicit Codex session evidence. It intentionally does not
// synthesize a workflow when a session has no SKILL.md load record.
function selectedRun() {
  if (state.monitorFilterActive && !state.selectedRunId) return null;
  const runs = state.overview?.runs || [];
  return runs.find((run) => run.runId === state.selectedRunId) || state.overview?.currentRun || runs[0] || null;
}
function selectedConversation(run) {
  if (!run) return null;
  const conversations = Array.isArray(run.conversations) ? run.conversations : [];
  return conversations.find((item) => item.conversationId === state.selectedConversationId) || null;
}
function monitorStatus(status) {
  return ({ discovered: '已发现', matched: '已匹配', selected: '已选中', loaded: '已加载', running: '进行中', handoff: '交接中', validating: '校验中', completed: '已完成', skipped: '已跳过', blocked: '已阻断', retrying: '重试中', failed: '失败' }[status] || '未观测');
}
function monitorTone(status) { return ['running', 'handoff', 'validating', 'retrying', 'matched', 'selected', 'loaded'].includes(status) ? 'active' : ['failed', 'blocked'].includes(status) ? 'problem' : ['completed', 'skipped'].includes(status) ? 'done' : 'idle'; }
function renderInspector(event, run) {
  const content = $('monitor-inspector-content'); const stateEl = $('monitor-inspector-state');
  if (!content || !stateEl) return;
  $('monitor-inspector')?.classList.remove('is-closed');
  if (!event) { stateEl.textContent = run?.status === 'failed' ? '失败' : run?.skills?.length ? '选择节点' : '无明确 Skill 事件'; content.innerHTML = `<div class="monitor-inspector-placeholder">${run?.status === 'failed' ? `<strong class="inspector-failure-title">失败原因</strong><p class="inspector-failure-reason">${esc(run.failureReason || '未提取到明确失败原因')}</p>` : run?.skills?.length ? '点击画布节点查看调用证据' : '该对话的 session 中没有读取 SKILL.md 的明确记录'}</div>`; return; }
  stateEl.textContent = monitorStatus(event.status);
  const reason = event.status === 'failed' ? (event.reason || event.message || run?.failureReason || '未提取到明确失败原因') : (event.reason || '无；已观测到调用结果');
  content.innerHTML = `<div class="inspector-skill"><span class="inspector-icon">⌘</span><div><strong>${esc(event.skill || event.label)}</strong><small>${esc(event.tool || 'custom_tool_call')}</small></div></div><dl class="inspector-meta"><div><dt>状态</dt><dd class="tone-${monitorTone(event.status)}">${monitorStatus(event.status)}</dd></div><div><dt>${event.status === 'failed' ? '失败原因' : '结果说明'}</dt><dd>${esc(reason)}</dd></div><div><dt>调用时间</dt><dd>${esc(formatDate(event.timestamp, true))}</dd></div><div><dt>调用 ID</dt><dd>${esc(event.callId || '未提供')}</dd></div><div><dt>证据来源</dt><dd class="inspector-path">${esc(event.sourcePath || run?.sourceFile || 'session')}</dd></div></dl>`;
}
function renderMonitor() {
  renderMonitorProjects();
  const run = selectedRun();
  const conversation = selectedConversation(run);
  const sourceEvents = conversation?.events || run?.events || [];
  const skills = sourceEvents.filter((item) => item.type === 'skill').slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const events = sourceEvents.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const done = skills.filter((item) => item.status === 'completed').length;
  const failed = skills.filter((item) => item.status === 'failed').length;
  const active = skills.filter((item) => item.status === 'running').length;
  const progress = skills.length ? Math.round(((done + failed) / skills.length) * 100) : run?.status === 'completed' ? 100 : 0;
  $('monitor-flow-title').textContent = run?.taskTitle || '选择一个对话';
  $('monitor-run-label').textContent = run ? `${run.runId} · ${run.project || run.cwd || '未标注项目'} · 更新于 ${formatDate(run.updatedAt, true)}` : '查看 Skill 调用流程与失败原因';
  $('monitor-run-status').textContent = run ? monitorStatus(run.status) : '未连接';
  $('monitor-run-status').className = `monitor-run-status tone-${monitorTone(run?.status)}`;
  $('monitor-summary').innerHTML = `<div><span>已观测技能</span><strong>${skills.length}</strong></div><div><span>已完成</span><strong>${done}</strong></div><div><span>进行中</span><strong>${active}</strong></div><div><span>失败</span><strong class="${failed ? 'tone-problem' : ''}">${failed}</strong></div>`;
  $('monitor-skill-count').textContent = `${skills.length} 个 Skill · ${events.length} 条事件`;
  $('monitor-progress').querySelector('span').style.width = `${progress}%`;
  const timeline = $('monitor-timeline'); timeline.replaceChildren();
  renderMonitorInfiniteCanvas(events, run, conversation);
  if (!events.length) { $('monitor-empty').hidden = false; $('monitor-empty').textContent = state.overviewError ? '监看数据暂时无法读取' : '当前对话暂无观测事件，画布保留完整技能网络'; if (run?.status === 'failed') renderInspector(null, run); else $('monitor-inspector')?.classList.add('is-closed'); return; }
  $('monitor-empty').hidden = true;
  let selectedEvent = events.slice().reverse().find((event) => event.status === 'failed') || null;
  events.slice().reverse().forEach((event, index) => {
    const item = document.createElement('li'); item.className = `monitor-event ${event.type === 'skill' ? 'skill-step' : 'task-step'} tone-${monitorTone(event.status)}`;
    item.innerHTML = `<button type="button" class="monitor-event-button"><span class="monitor-event-marker"></span><span class="monitor-event-body"><strong>${esc(event.skill || event.label || '任务事件')}</strong><small>${esc(event.label || '状态更新')} · ${monitorStatus(event.status)}</small></span><time>${esc(formatDate(event.timestamp, true))}</time></button>`;
    item.querySelector('button').addEventListener('click', () => { selectedEvent = event; document.querySelectorAll('.monitor-event').forEach((node) => node.classList.remove('is-focused')); item.classList.add('is-focused'); renderInspector(event, run); });
    timeline.append(item);
    if (!selectedEvent && index === 0) selectedEvent = event;
  });
  if (selectedEvent?.status === 'failed') renderInspector(selectedEvent, run);
  else $('monitor-inspector')?.classList.add('is-closed');
}
function connectMonitorStream() {
  if (state.monitorStream || !window.EventSource) return;
  const stream = new EventSource('/api/events/stream'); state.monitorStream = stream;
  stream.addEventListener('open', () => setMonitorConnection('live', '实时同步'));
  stream.addEventListener('skill', loadOverview);
  stream.addEventListener('session-update', loadOverview);
  stream.addEventListener('error', () => setMonitorConnection('offline', '等待重连'));
}
function switchWorkspace(view) {
  // The standalone 技能 page is intentionally management-only. Real-time
  // execution status belongs to the task page's single-conversation activity
  // control, so an old deep link cannot reopen the removed canvas surface.
  if (view !== 'manage' || view === state.view) return;
  state.view = view; const token = ++state.transitionToken;
  document.querySelectorAll('[data-workspace-view]').forEach((item) => { const selected = item.dataset.workspaceView === view; item.classList.toggle('is-active', selected); item.setAttribute('aria-selected', String(selected)); });
  document.querySelectorAll('.workspace-content').forEach((panel) => { panel.classList.remove('is-entering'); panel.hidden = panel.id !== `workspace-${view}`; panel.setAttribute('aria-hidden', String(panel.hidden)); });
  const next = document.getElementById(`workspace-${view}`); if (next) { next.classList.add('is-entering'); requestAnimationFrame(() => { if (token === state.transitionToken) next.classList.remove('is-entering'); }); }
  if (view === 'monitor') { loadOverview(); connectMonitorStream(); clearInterval(state.monitorTimer); state.monitorTimer = setInterval(loadOverview, 3000); } else { clearInterval(state.monitorTimer); disconnectMonitorStream(); }
}
function renderMonitorProjects() {
  const runs = state.overview?.runs || [];
  const projectSelect = $('monitor-project-filter');
  const taskSelect = $('monitor-task-filter');
  const conversationSelect = $('monitor-conversation-filter');
  const projects = [...new Set(runs.map((run) => run.project || run.cwd || '未标注项目'))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  if (state.monitorProject === null) state.monitorProject = selectedRun()?.project || '';
  if (state.monitorProject && !projects.includes(state.monitorProject)) state.monitorProject = '';
  if (projectSelect) {
    projectSelect.replaceChildren(new Option('选择项目', ''), ...projects.map((project) => new Option(project, project)));
    projectSelect.value = state.monitorProject;
  }
  const query = normalized(state.monitorTaskQuery || '');
  const filtered = runs.filter((run) => (!state.monitorProject || (run.project || run.cwd || '未标注项目') === state.monitorProject) && (!query || normalized(`${run.taskTitle} ${run.runId} ${(run.conversations || []).map((item) => item.title).join(' ')}`).includes(query)));
  if (taskSelect) {
    taskSelect.replaceChildren(new Option(state.monitorProject ? '选择任务' : '全部任务', ''));
    filtered.forEach((run) => taskSelect.append(new Option(run.taskTitle || run.runId, run.runId)));
    taskSelect.disabled = !filtered.length;
    if (filtered.some((run) => run.runId === state.selectedRunId)) taskSelect.value = state.selectedRunId;
    else if (state.monitorFilterActive && filtered[0]) { state.selectedRunId = filtered[0].runId; taskSelect.value = filtered[0].runId; }
    else { state.selectedRunId = ''; taskSelect.value = ''; }
  }
  if (conversationSelect) {
    const task = filtered.find((item) => item.runId === state.selectedRunId);
    const conversations = task?.conversations || [];
    conversationSelect.replaceChildren(new Option(task ? '选择对话' : '先选择任务', ''), ...conversations.map((item) => new Option(item.title || item.conversationId, item.conversationId)));
    conversationSelect.disabled = !task || !conversations.length;
    if (conversations.some((item) => item.conversationId === state.selectedConversationId)) conversationSelect.value = state.selectedConversationId;
    else if (state.selectedRunId && conversations[0]) { state.selectedConversationId = conversations[0].conversationId; conversationSelect.value = state.selectedConversationId; }
    else { state.selectedConversationId = ''; conversationSelect.value = ''; }
  }
  const count = $('monitor-task-count'); if (count) count.textContent = String(filtered.length);
}
document.querySelector('#monitor-project-filter')?.addEventListener('change', (event) => { state.monitorFilterActive = true; state.monitorProject = event.target.value; state.selectedRunId = ''; renderMonitor(); });
document.querySelector('#monitor-task-filter')?.addEventListener('change', (event) => { state.monitorFilterActive = true; state.selectedRunId = event.target.value; state.selectedConversationId = ''; renderMonitor(); });
document.querySelector('#monitor-conversation-filter')?.addEventListener('change', (event) => { state.monitorFilterActive = true; state.selectedConversationId = event.target.value; renderMonitor(); });
document.querySelector('#monitor-task-search')?.addEventListener('input', (event) => { state.monitorFilterActive = true; state.monitorTaskQuery = event.target.value; renderMonitor(); });
document.querySelector('#monitor-filter-clear')?.addEventListener('click', () => { state.monitorFilterActive = true; state.monitorTaskQuery = ''; state.monitorProject = ''; state.selectedRunId = ''; state.selectedConversationId = ''; const search = $('monitor-task-search'); if (search) search.value = ''; renderMonitor(); });
document.querySelector('#monitor-inspector-close')?.addEventListener('click', () => $('monitor-inspector')?.classList.add('is-closed'));

window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.source !== 'codex-sidebar-enhancer') return;
  if (data.type === 'close-skill-detail') closeSkillDetail();
  if (data.type === 'theme-change' && (data.theme === 'light' || data.theme === 'dark')) {
    document.documentElement.dataset.theme = data.theme;
    if (typeof data.surface === 'string') document.documentElement.style.setProperty('--host-bg', data.surface);
  }
});
loadSkills();
