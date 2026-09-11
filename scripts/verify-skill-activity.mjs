import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { connectMainCodex } from '../integrations/cdp-client.mjs';

const port = Number(process.argv[2] || 9232);
const outputPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'artifacts', 'skill-activity-popover.png');
const client = await connectMainCodex(port);

try {
  const opened = await client.evaluate(`(() => {
    const trigger = document.querySelector('#codex-skill-activity-trigger');
    if (!trigger) return { trigger: false, popover: false };
    if (!document.querySelector('#codex-skill-activity-popover')) trigger.click();
    return { trigger: true, popover: Boolean(document.querySelector('#codex-skill-activity-popover')) };
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const snapshot = await client.evaluate(`(() => {
    const rail = document.querySelector('#codex-thread-overview-rail');
    const trigger = document.querySelector('#codex-skill-activity-trigger');
    const popover = document.querySelector('#codex-skill-activity-popover');
    const toolbar = document.querySelector('[data-app-shell-header-toolbar="true"]');
    const rect = popover?.getBoundingClientRect();
    const toolbarRect = toolbar?.getBoundingClientRect();
    return {
      railExists: Boolean(rail),
      contentLeft: toolbarRect?.left || null,
      trigger: trigger ? { text: trigger.innerText, status: trigger.dataset.status, expanded: trigger.getAttribute('aria-expanded') } : null,
      popover: popover ? {
        text: popover.innerText,
        status: popover.dataset.status,
        nodeCount: popover.querySelectorAll('.codex-skill-trace-node').length,
        bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        staysInsideContent: Boolean(toolbarRect && rect.x >= toolbarRect.left - 1),
      } : null,
    };
  })()`);
  const screenshot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(screenshot.data, 'base64'));

  const escapeClosed = await client.evaluate(`(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    return !document.querySelector('#codex-skill-activity-popover')
      && document.querySelector('#codex-skill-activity-trigger')?.getAttribute('aria-expanded') === 'false';
  })()`);

  const outsideClickClosed = await client.evaluate(`(() => {
    document.querySelector('#codex-skill-activity-trigger')?.click();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    return !document.querySelector('#codex-skill-activity-popover')
      && document.querySelector('#codex-skill-activity-trigger')?.getAttribute('aria-expanded') === 'false';
  })()`);

  console.log(JSON.stringify({ opened, ...snapshot, escapeClosed, outsideClickClosed, screenshot: outputPath }, null, 2));
} finally {
  client.close();
}
