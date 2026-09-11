import { connectMainCodex } from "../../_enhancer-inspect/scripts/cdp-client.mjs";

const port = Number(process.env.CODEX_DEBUG_PORT || 9232);
const client = await connectMainCodex(port);

try {
  const result = await client.evaluate(`(() => {
    const aside = document.querySelector('aside');
    if (!aside) return { error: 'no aside' };
    const buttons = Array.from(aside.querySelectorAll('button'));
    const out = [];
    for (const button of buttons) {
      const label = button.querySelector('.text-fade-truncate')?.textContent?.trim()
        || button.getAttribute('aria-label')?.trim() || '';
      if (!label) continue;
      const svg = button.querySelector('svg');
      const rect = button.getBoundingClientRect();
      if (rect.height < 5) continue;
      out.push({
        label,
        svgHtml: svg ? svg.outerHTML : null,
        buttonClass: button.className,
        wrapperClass: button.parentElement?.className,
        rowClass: button.parentElement?.parentElement?.className,
        nextSiblingTag: button.parentElement?.nextElementSibling?.className,
      });
      if (out.length >= 12) break;
    }
    return { buttons: out };
  })()`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  client.close();
}
