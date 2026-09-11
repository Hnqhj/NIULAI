import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const source = await readFile(new URL("../integrations/conversation-preview.user.js", import.meta.url), "utf8");
const styleEnd = source.indexOf("(document.head || document.documentElement).appendChild(style);");
assert.ok(styleEnd > 0, "Adapter style installer exists");
const styleInstaller = source.slice(0, source.indexOf("\n  }", styleEnd) + 4) + "\ninstallStyles();})();";
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.setContent(`<!doctype html><html><head><style>
    body { margin: 0; } #shell { display: flex; padding-top: 36px; }
    aside { position: relative; height: 760px; } main { flex: 1; }
    header.fixed { position: fixed; top: 36px; right: 0; height: 46px; }
    .resizer { position: absolute; width: 16px; right: -8px; top: -36px; bottom: 0; }
    [role=separator] { position: absolute; inset: 0; cursor: col-resize; }
  </style></head><body>
    <button data-app-shell-sidebar-trigger aria-expanded="true">Toggle</button>
    <div id="shell"><aside class="app-shell-left-panel" style="width: 700px">
      <div class="max-w-full" style="min-width: 700px; width: 700px">
        <div id="app-shell-sidebar"><div data-app-action-sidebar-scroll>Projects</div></div>
      </div>
      <div class="group/panel-resizer resizer"><div role="separator" aria-orientation="vertical" class="cursor-col-resize"></div></div>
    </aside><main>Workspace</main></div>
    <header class="fixed pointer-events-none" data-app-shell-header-layout="thread-edge-scroll" style="left: 700px">Title</header>
    <div class="app-header-tint" id="unrelated">Unrelated tint</div>
  </body></html>`);
  await page.evaluate(styleInstaller);
  await page.evaluate(() => {
    window.resizeStarts = 0;
    document.querySelector("[role=separator]").addEventListener("pointerdown", () => { window.resizeStarts += 1; });
  });
  for (const view of ["list", "card"]) {
    for (const layout of ["thread-edge-scroll", "default"]) {
      for (const width of [1034, 1920]) {
        await page.setViewportSize({ width, height: 800 });
        await page.evaluate(({ view, layout }) => {
          document.documentElement.dataset.codexTaskShell = "true";
          document.documentElement.dataset.codexConversationView = view;
          document.querySelector("header").dataset.appShellHeaderLayout = layout;
        }, { view, layout });
        for (const staleWidth of [260, 455, 700]) {
          await page.evaluate(value => {
            document.querySelector("aside").style.width = `${value}px`;
            document.querySelector("header").style.left = `${value}px`;
          }, staleWidth);
          const geometry = await page.evaluate(() => ({
            panel: document.querySelector("aside").getBoundingClientRect().width,
            inner: document.querySelector("#app-shell-sidebar").getBoundingClientRect().width,
            title: document.querySelector("header").getBoundingClientRect().left,
            handle: document.querySelector("[role=separator]").getBoundingClientRect().width,
          }));
          assert.deepEqual(geometry, { panel: 460, inner: 460, title: 460, handle: 0 });
        }
        await page.mouse.move(460, 180);
        await page.mouse.down();
        await page.mouse.move(700, 180, { steps: 8 });
        await page.mouse.up();
        assert.equal(await page.evaluate(() => window.resizeStarts), 0);
        await page.locator("[data-app-shell-sidebar-trigger]").evaluate(e => e.setAttribute("aria-expanded", "false"));
        assert.deepEqual(await page.evaluate(() => [document.querySelector("aside").getBoundingClientRect().width, document.querySelector("header").getBoundingClientRect().left]), [0, 0]);
        await page.locator("[data-app-shell-sidebar-trigger]").evaluate(e => e.setAttribute("aria-expanded", "true"));
      }
    }
  }
  await page.evaluate(() => { document.documentElement.dataset.codexCustomWorkspace = "true"; });
  assert.equal(await page.locator("header").evaluate(e => getComputedStyle(e).visibility), "hidden");
  await page.evaluate(() => { document.documentElement.dataset.codexCustomWorkspace = "false"; });
  assert.equal(await page.locator("header").evaluate(e => getComputedStyle(e).visibility), "visible");
  assert.equal(await page.locator("#unrelated").evaluate(e => getComputedStyle(e).left), "auto");
  await page.locator("header").evaluate(e => { e.removeAttribute("data-app-shell-header-layout"); e.classList.add("app-header-tint"); });
  assert.equal(await page.locator("header").evaluate(e => e.getBoundingClientRect().left), 460);
  await page.locator("aside").evaluate(e => e.remove());
  assert.equal(await page.locator("header").evaluate(e => e.getBoundingClientRect().left), 700);
  console.log("Sidebar layout passed: list/card, both headers, 1034/1920px, stale widths, drag, collapse, custom workspace, legacy header, no-sidebar route.");
} finally {
  await browser.close();
}
