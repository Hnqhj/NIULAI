import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { connectMainCodex } from '../integrations/cdp-client.mjs';

const port = Number(process.argv[2] || 9232);
const outputPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'artifacts', 'skill-rail.png');
const client = await connectMainCodex(port);

try {
  const snapshot = await client.evaluate(`(() => {
    let refreshError = '';
    try { window.__codexConversationPreviewInjection__?.refresh?.(); } catch (error) { refreshError = error?.stack || String(error); }
    const rail = document.querySelector('#codex-thread-overview-rail');
    const trigger = document.querySelector('#codex-skill-activity-trigger');
    const popover = document.querySelector('#codex-skill-activity-popover');
    const toolbar = document.querySelector('[data-app-shell-header-toolbar="true"]');
    const headers = Array.from(document.querySelectorAll('header[data-app-shell-header-layout]')).map((header) => ({
      html: header.outerHTML.slice(0, 6000),
      text: header.innerText,
      bounds: (() => { const rect = header.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; })(),
    }));
    const nodes = Array.from(rail?.querySelectorAll('.codex-skill-trace-node') || []);
    const rect = rail?.getBoundingClientRect();
    return {
      url: location.href,
      refreshError,
      toolbarChildren: Array.from(toolbar?.children || []).map((node) => {
        const rect = node.getBoundingClientRect();
        return { text: node.innerText, x: rect.x, y: rect.y, width: rect.width, height: rect.height, className: node.className };
      }),
      headers,
      sourceHash: window.__CODEX_CONVERSATION_PREVIEW_SOURCE_HASH__ || null,
      trigger: trigger ? {
        text: trigger.innerText,
        status: trigger.dataset.status,
        expanded: trigger.getAttribute('aria-expanded'),
        parent: trigger.parentElement?.outerHTML.slice(0, 2000),
        bounds: (() => { const rect = trigger.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; })(),
      } : null,
      popover: popover ? {
        text: popover.innerText,
        status: popover.dataset.status,
        bounds: (() => { const rect = popover.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; })(),
      } : null,
      layout: rail?.dataset.overviewLayout || null,
      text: rail?.innerText || '',
      hasNewStyles: Boolean(document.getElementById('codex-conversation-preview-style')?.textContent.includes('codex-skill-trace-node-head')),
      hasActivityStyles: Boolean(document.getElementById('codex-conversation-preview-style')?.textContent.includes('codex-skill-activity-trigger')),
      bounds: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      nodes: nodes.map((node) => ({
        name: node.querySelector('strong')?.textContent || '',
        status: node.dataset.status || '',
        statusText: node.querySelector('.codex-skill-trace-status')?.textContent || '',
        meta: node.querySelector('.codex-skill-trace-meta')?.textContent || '',
        detail: node.querySelector('.codex-skill-trace-detail')?.textContent || '',
        display: getComputedStyle(node).display,
        background: getComputedStyle(node).backgroundColor,
        borderBottom: getComputedStyle(node).borderBottom,
      })),
    };
  })()`);
  const screenshot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(screenshot.data, 'base64'));
  console.log(JSON.stringify({ ...snapshot, screenshot: outputPath }, null, 2));
} finally {
  client.close();
}
