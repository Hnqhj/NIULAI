#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { closeSync, existsSync, openSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";

import { connectMainCodex, readTargets, selectMainCodexTarget } from "./cdp-client.mjs";
import { assetBrowserRuntime, ensureAssetBrowserState } from "../lib/install-config.mjs";
import { PreviewRepository } from "../lib/preview-data.mjs";
import { presentCardPreview } from "../lib/card-view.mjs";
import { presentRateLimit } from "../lib/usage-data.mjs";
import { normalizeTaskId, updateTaskSkillDefaults, updateTaskPromptDepth, TASK_PROMPT_COMPLEXITY_VALUES } from "../lib/task-context-store.mjs";
import { needsPreviewAttachment } from "../lib/injector-state.mjs";
import { buildHomeProjectShelf, readTaskboardSnapshot } from "../lib/home-projects.mjs";
import {
  ASSET_CONSOLE_EMBED_ORIGIN,
  assetConsoleEmbedPrefix,
  assetConsoleEmbedUrl,
  assetConsoleLocalRequestHeaders,
  assetConsoleRoute,
  assetConsolePreviewRoute,
  assetConsoleDirectPreviewFrame,
  responseHeadersForCdp,
  transformAssetConsoleBody,
} from "../lib/asset-console-embed.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The packaged runtime stores the adapter in `inject/`; repository repair
// runs keep it under `integrations/`. Resolve both layouts without making the
// installed injector depend on repository-only paths.
const sourcePath = existsSync(path.join(root, "inject", "conversation-preview.user.js"))
  ? path.join(root, "inject", "conversation-preview.user.js")
  : path.join(root, "integrations", "conversation-preview.user.js");
const SCRIPT_ID_GLOBAL = "__CODEX_CONVERSATION_PREVIEW_SCRIPT_IDENTIFIER__";
const DEFAULT_SKILLS_BINDING = "codexSidebarDefaultSkills";
const PROMPT_DEPTH_BINDING = "codexSidebarPromptDepth";
const ASSET_CONSOLE_BINDING = "codexSidebarOpenAssetConsole";
const SKILL_CONSOLE_BINDING = "codexSidebarOpenSkillConsole";
const assetRuntime = assetBrowserRuntime({ installDir: root });
await ensureAssetBrowserState(assetRuntime);
// 2.0 bundles asset-browser beside the injector. Keep compatibility with the
// existing Windows installation that stores the service under LocalAppData.
const legacyAssetRoot = process.platform === "win32" && process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "AssetBrowser") : "";
const bundledAssetAvailable = existsSync(assetRuntime.serverPath);
const assetConsoleRoot = bundledAssetAvailable ? assetRuntime.sourceRoot : legacyAssetRoot;
const assetConsoleServer = bundledAssetAvailable ? assetRuntime.serverPath : (legacyAssetRoot ? path.join(legacyAssetRoot, "server.js") : null);
const assetConsoleApiTokenPath = bundledAssetAvailable ? assetRuntime.tokenPath : (legacyAssetRoot ? path.join(legacyAssetRoot, ".api-token") : null);
// Reuse a healthy legacy Windows service when it already owns port 5177.
let activeAssetConsoleApiTokenPath = assetConsoleApiTokenPath;
let enhancerConfig = {};
try { enhancerConfig = JSON.parse(await readFile(path.join(root, "enhancer.config.json"), "utf8")); } catch (error) {
  if (error.code !== "ENOENT") console.error(`UI configuration could not be read: ${error.message}`);
}
const assetConsoleUrl = "http://127.0.0.1:5177/";
const skillConsoleUrl = "http://127.0.0.1:4187/";
const embeddedAssetConsoleRoot = path.join(root, "asset-console", "public");
const embeddedAssetConsoleFiles = new Map([
  ["/", { name: "index.html", type: "text/html; charset=utf-8" }],
  ["/index.html", { name: "index.html", type: "text/html; charset=utf-8" }],
  ["/app.js", { name: "app.js", type: "text/javascript; charset=utf-8" }],
  ["/asset-classification.js", { name: "asset-classification.js", type: "text/javascript; charset=utf-8" }],
  ["/styles.css", { name: "styles.css", type: "text/css; charset=utf-8" }],
  ["/ui-v3.css", { name: "ui-v3.css", type: "text/css; charset=utf-8" }],
]);
async function embeddedAssetConsoleResponse(route, method, panelKind = "asset", body = null) {
  let pathname;
  try { pathname = new URL(route, assetConsoleUrl).pathname; } catch { return null; }
  if (panelKind !== "asset" || method !== "GET") return null;
  const files = embeddedAssetConsoleFiles;
  const staticRoot = embeddedAssetConsoleRoot;
  const file = files.get(pathname);
  if (!file) return null;
  const staticBody = await readFile(path.join(staticRoot, file.name));
  return {
    status: 200,
    headers: { "content-type": file.type, "cache-control": "no-store" },
    body: staticBody,
  };
}

function parseArgs(argv) {
  const options = { port: 9231, watch: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--watch") options.watch = true;
    else if (arg === "--port") options.port = Number(argv[++index]);
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error("Invalid port");
  return options;
}

async function targetId(port) {
  try {
    return selectMainCodexTarget(await readTargets(port))?.id || null;
  } catch {
    return null;
  }
}

const options = parseArgs(process.argv.slice(2));
const repository = new PreviewRepository();

let stopped = false;
let attachedTargetId = null;
let client = null;
let registeredScriptIdentifier = null;
let removeBindingListener = null;
let removeDefaultSkillsListener = null;
let removePromptDepthListener = null;
let assetConsoleProxy = null;
let assetConsoleProxyQueue = Promise.resolve();
let assetConsoleStartPromise = null;
let assetConsoleRequestGeneration = 0;
const MAX_BUFFERED_ASSET_CONSOLE_RESPONSE_BYTES = 64 * 1024 * 1024;
const MAX_ASSET_CONSOLE_MEDIA_RANGE_BYTES = 8 * 1024 * 1024;

function requestAssetConsole({
  method = "GET",
  route = "/",
  headers = {},
  body = null,
  apiToken = "",
  timeoutMs = 15_000,
  maxResponseBytes = MAX_BUFFERED_ASSET_CONSOLE_RESPONSE_BYTES,
} = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    let isMediaRoute = false;
    try { isMediaRoute = new URL(route, assetConsoleUrl).pathname === "/media"; } catch {}
    const requestHeaders = assetConsoleLocalRequestHeaders(headers, apiToken, {
      maxOpenRangeBytes: isMediaRoute ? MAX_ASSET_CONSOLE_MEDIA_RANGE_BYTES : 0,
    });
    const request = http.request({
      hostname: "127.0.0.1",
      port: 5177,
      path: route,
      method,
      headers: requestHeaders,
    }, (response) => {
      response.on("error", rejectOnce);
      response.on("aborted", () => rejectOnce(new Error("Asset Console response was aborted")));
      const declaredLength = Number(response.headers["content-length"]);
      if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
        response.destroy(new Error(`Asset Console response exceeds ${maxResponseBytes} bytes`));
        return;
      }
      const chunks = [];
      let receivedBytes = 0;
      response.on("data", (chunk) => {
        receivedBytes += chunk.length;
        if (receivedBytes > maxResponseBytes) {
          response.destroy(new Error(`Asset Console response exceeds ${maxResponseBytes} bytes`));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        if (settled) return;
        settled = true;
        resolve({
          status: response.statusCode || 502,
          headers: response.headers,
          body: Buffer.concat(chunks, receivedBytes),
        });
      });
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error("Asset Console request timed out")));
    request.on("error", rejectOnce);
    if (body) request.write(body);
    request.end();
  });
}

async function assetConsoleIsReady() {
  const tokenPaths = [...new Set([
    activeAssetConsoleApiTokenPath,
    !bundledAssetAvailable && legacyAssetRoot ? path.join(legacyAssetRoot, ".api-token") : null,
  ].filter(Boolean))];
  let lastStatus = 0;
  for (const tokenPath of tokenPaths) {
    let apiToken;
    try { apiToken = (await readFile(tokenPath, "utf8")).trim(); } catch { continue; }
    let response;
    try { response = await requestAssetConsole({ route: "/api/config", apiToken, timeoutMs: 500 }); }
    catch (error) {
      if (error.code === "ECONNREFUSED") return false;
      throw new Error(`资产控制台端口 5177 暂不可用：${error.message}`);
    }
    lastStatus = response.status;
    let config;
    try { config = JSON.parse(response.body.toString("utf8")); } catch {}
    if (response.status === 200 && Array.isArray(config?.projects)) {
      activeAssetConsoleApiTokenPath = tokenPath;
      return true;
    }
  }
  if (lastStatus === 403) throw new Error("端口 5177 已被其他服务或不同配置的资产控制台占用；请先关闭该服务后重试。");
  return false;
}

function stopKnownLegacyAssetService() {
  if (process.platform !== "win32" || !bundledAssetAvailable || !legacyAssetRoot) return Promise.resolve(false);
  const escaped = legacyAssetRoot.replace(/'/g, "''");
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-Command", `$root='${escaped}'; $items=Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -like \"*$root*server.js*\" }; foreach($item in $items){ Stop-Process -Id $item.ProcessId -Force -ErrorAction SilentlyContinue }; if($items){ 'stopped' }`], (error, stdout) => {
      resolve(!error && String(stdout || "").includes("stopped"));
    });
  });
}

async function ensureAssetConsoleServer() {
  try {
    if (await assetConsoleIsReady()) return;
  } catch (error) {
    if (!bundledAssetAvailable || !String(error.message || "").includes("端口 5177")) throw error;
    await stopKnownLegacyAssetService();
  }
  if (!assetConsoleRoot || !assetConsoleServer || !existsSync(assetConsoleServer)) {
    throw new Error("没有找到本机资产控制台服务");
  }
  if (!assetConsoleStartPromise) {
    assetConsoleStartPromise = (async () => {
      const stdoutPath = path.join(assetRuntime.stateRoot, "asset-browser.stdout.log");
      const stderrPath = path.join(assetRuntime.stateRoot, "asset-browser.stderr.log");
      let stdoutFd;
      let stderrFd;
      try {
        stdoutFd = openSync(stdoutPath, "a");
        stderrFd = openSync(stderrPath, "a");
        const child = spawn(process.execPath, [assetConsoleServer], {
          cwd: assetConsoleRoot,
          detached: true,
          windowsHide: true,
          stdio: ["ignore", stdoutFd, stderrFd],
          env: {
            ...process.env,
            ...assetRuntime.env,
            NO_PROXY: "localhost,127.0.0.1,::1",
            no_proxy: "localhost,127.0.0.1,::1",
            HTTP_PROXY: "",
            HTTPS_PROXY: "",
            ALL_PROXY: "",
            http_proxy: "",
            https_proxy: "",
            all_proxy: "",
          },
        });
        child.unref();
      } finally {
        if (stdoutFd !== undefined) closeSync(stdoutFd);
        if (stderrFd !== undefined) closeSync(stderrFd);
      }
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (await assetConsoleIsReady()) return;
      }
      throw new Error("资产控制台服务没有在 15 秒内准备完成");
    })().finally(() => { assetConsoleStartPromise = null; });
  }
  await assetConsoleStartPromise;
}

function queueAssetConsoleProxyWork(work) {
  const pending = assetConsoleProxyQueue.then(work, work);
  assetConsoleProxyQueue = pending.catch(() => {});
  return pending;
}

async function failAssetConsoleRequest(proxy, event, sessionId) {
  try {
    await proxy.client.send("Fetch.failRequest", {
      requestId: event.requestId,
      errorReason: "BlockedByClient",
    }, sessionId);
  } catch {}
}

async function activateAssetConsoleSession(proxy, sessionId) {
  const info = proxy.sessionInfo.get(sessionId);
  if (!info || info.active || proxy.cancelled) return;
  info.active = true;
  proxy.assetSessions.add(sessionId);
  try {
    // Once the private frame is identified, intercept every request from it so
    // the embedded app cannot use the synthetic public origin as an egress path.
    await proxy.client.send("Fetch.enable", {
      patterns: [{ urlPattern: "*", requestStage: "Request" }],
    }, sessionId);
    await proxy.client.send("Target.setAutoAttach", {
      autoAttach: true, waitForDebuggerOnStart: true, flatten: true,
    }, sessionId);
  } catch (error) {
    info.active = false;
    proxy.assetSessions.delete(sessionId);
    throw error;
  }
}

async function proxyAssetConsoleRequest(event, sessionId, proxy) {
  if (proxy.cancelled) return failAssetConsoleRequest(proxy, event, sessionId);
  let url;
  try { url = new URL(event.request.url); } catch {
    return failAssetConsoleRequest(proxy, event, sessionId);
  }
  const isPrivateEmbedRequest = url.origin === ASSET_CONSOLE_EMBED_ORIGIN
    && url.pathname.startsWith(proxy.embedPrefix);
  let previewRoute = null;
  const isPreview = proxy.panelKind === "asset" && proxy.allowedFrameId
    && event.frameId && event.frameId !== proxy.allowedFrameId;
  if (isPreview) {
    try {
      const { frameTree } = await proxy.client.send("Page.getFrameTree", {}, sessionId);
      if (!assetConsoleDirectPreviewFrame(frameTree, event.frameId, proxy.allowedFrameId)) {
        return failAssetConsoleRequest(proxy, event, sessionId);
      }
      const documentUrl = proxy.previewDocuments.get(event.frameId)
        || (event.resourceType === "Document" ? event.request.url : null);
      if (!documentUrl) return failAssetConsoleRequest(proxy, event, sessionId);
      previewRoute = assetConsolePreviewRoute(event.request.url, { method: event.request.method, documentUrl });
      if (!previewRoute) return failAssetConsoleRequest(proxy, event, sessionId);
      proxy.previewDocuments.set(event.frameId, documentUrl);
    } catch { return failAssetConsoleRequest(proxy, event, sessionId); }
  }

  if (isPreview) {
    // Preview documents have a separate read-only scope, never panel API access.
  } else if (!sessionId) {
    if (!isPrivateEmbedRequest || !event.frameId) return failAssetConsoleRequest(proxy, event, sessionId);
    if (proxy.allowedFrameId && proxy.allowedFrameId !== event.frameId) {
      return failAssetConsoleRequest(proxy, event, sessionId);
    }
    proxy.allowedFrameId = event.frameId;
    for (const [candidateSessionId, info] of proxy.sessionInfo) {
      if (info.targetId === proxy.allowedFrameId) {
        try { await activateAssetConsoleSession(proxy, candidateSessionId); } catch {}
      }
    }
  } else {
    const info = proxy.sessionInfo.get(sessionId);
    const frameMatches = Boolean(info && proxy.allowedFrameId
      && info.targetId === proxy.allowedFrameId
      && (!event.frameId || event.frameId === proxy.allowedFrameId));
    if (isPrivateEmbedRequest && !proxy.allowedFrameId && info && event.frameId === info.targetId) {
      proxy.allowedFrameId = event.frameId;
    }
    const confirmedFrame = Boolean(info && proxy.allowedFrameId
      && info.targetId === proxy.allowedFrameId
      && (!event.frameId || event.frameId === proxy.allowedFrameId));
    if (isPrivateEmbedRequest && confirmedFrame) {
      try { await activateAssetConsoleSession(proxy, sessionId); } catch {
        return failAssetConsoleRequest(proxy, event, sessionId);
      }
    } else if (!frameMatches || !proxy.assetSessions.has(sessionId)) {
      // A different sandbox frame may know the public prefix, but it never gets
      // access to localhost without both the per-open nonce and exact frame id.
      return failAssetConsoleRequest(proxy, event, sessionId);
    }
  }

  const assetSession = Boolean(sessionId && proxy.assetSessions.has(sessionId));
  const route = previewRoute || (proxy.panelKind === "skill"
    ? (isPrivateEmbedRequest
      ? `${url.pathname.slice(proxy.embedPrefix.length - 1) || "/"}${url.search}`
      : (assetSession && url.pathname.startsWith("/api/") ? `${url.pathname}${url.search}` : null))
    : assetConsoleRoute(event.request.url, { token: proxy.token, assetSession }));
  if (!route) {
    // The dedicated frame is fail-closed: it may only load its private static
    // files and the two local API namespaces used by Asset Console.
    if (assetSession) proxy.assetSessions.delete(sessionId);
    return failAssetConsoleRequest(proxy, event, sessionId);
  }
  try {
    const response = (!isPreview && await embeddedAssetConsoleResponse(
      route,
      event.request.method,
      proxy.panelKind,
      event.request.postData || null,
    )) || (proxy.panelKind === "skill" ? await requestSkillConsole({
      method: event.request.method,
      route,
      headers: event.request.headers,
      body: event.request.postData || null,
    }) : proxy.panelKind === "asset" ? await requestAssetConsole({
      method: event.request.method,
      route,
      headers: event.request.headers,
      body: event.request.postData || null,
      apiToken: proxy.apiToken,
      timeoutMs: route.startsWith("/api/source-roots/pick-folder") ? 130_000 : 15_000,
    }) : null);
    if (!response) throw new Error("Blocked workspace panel route");
    const body = isPreview ? response.body : proxy.panelKind === "skill"
      ? transformSkillConsoleBody(event.request.url, response.body, proxy.token)
      : transformAssetConsoleBody(event.request.url, response.body, { token: proxy.token });
    await proxy.client.send("Fetch.fulfillRequest", {
      requestId: event.requestId,
      responseCode: response.status,
      responseHeaders: responseHeadersForCdp(response.headers, body.length),
      body: body.toString("base64"),
    }, sessionId);
  } catch {
    await failAssetConsoleRequest(proxy, event, sessionId);
  }
}

async function disposeAssetConsoleProxy(proxy) {
  if (!proxy || proxy.disposed) return;
  proxy.cancelled = true;
  proxy.disposed = true;
  if (assetConsoleProxy === proxy) assetConsoleProxy = null;
  proxy.removeAttachedListener?.();
  proxy.removePausedListener?.();
  try { await proxy.client.send("Fetch.disable"); } catch {}
  for (const sessionId of proxy.sessions) {
    try { await proxy.client.send("Fetch.disable", {}, sessionId); } catch {}
    try { await proxy.client.send("Target.setAutoAttach", { autoAttach: false, waitForDebuggerOnStart: false, flatten: true }, sessionId); } catch {}
  }
  proxy.sessions.clear();
  proxy.assetSessions.clear();
  proxy.sessionInfo.clear();
  proxy.previewDocuments.clear();
  proxy.allowedFrameId = null;
  proxy.token = null;
  proxy.apiToken = null;
  try {
    await proxy.client.send("Target.setAutoAttach", {
      autoAttach: false,
      waitForDebuggerOnStart: false,
      flatten: true,
    });
  } catch {}
}

async function setupAssetConsoleProxy(generation, panelKind = "asset") {
  return queueAssetConsoleProxyWork(async () => {
    if (generation !== assetConsoleRequestGeneration || stopped || !client) return null;
    if (assetConsoleProxy) await disposeAssetConsoleProxy(assetConsoleProxy);
    if (generation !== assetConsoleRequestGeneration || stopped || !client) return null;

    const token = randomBytes(24).toString("hex");
    const apiToken = panelKind === "asset" && activeAssetConsoleApiTokenPath
      ? (await readFile(activeAssetConsoleApiTokenPath, "utf8")).trim()
      : "";
    if (panelKind === "asset" && !apiToken) throw new Error("资产控制台本机令牌不可用");
    const proxy = {
      client,
      generation,
      token,
      apiToken,
      panelKind,
      embedPrefix: assetConsoleEmbedPrefix(token),
      embedUrl: assetConsoleEmbedUrl(token),
      allowedFrameId: null,
      sessions: new Set(),
      assetSessions: new Set(),
      sessionInfo: new Map(),
      previewDocuments: new Map(),
      cancelled: false,
      disposed: false,
      removeAttachedListener: null,
      removePausedListener: null,
    };
    // Publish the provisional object before the first await. A close request can
    // now cancel it even while CDP is still answering setup commands.
    assetConsoleProxy = proxy;
    proxy.removeAttachedListener = proxy.client.on("Target.attachedToTarget", async (event) => {
      const sessionId = event.sessionId;
      const targetUrl = event.targetInfo?.url || "";
      let isPreviewTarget = false;
      if (sessionId && proxy.panelKind === "asset" && proxy.allowedFrameId && event.targetInfo?.type === "iframe") {
        try {
          const { frameTree } = await proxy.client.send("Page.getFrameTree", {}, sessionId);
          isPreviewTarget = assetConsoleDirectPreviewFrame(frameTree, event.targetInfo.targetId, proxy.allowedFrameId);
        } catch {}
      }
      const isCandidate = Boolean(sessionId
        && event.targetInfo?.type === "iframe"
        && (isPreviewTarget || !targetUrl || targetUrl.startsWith(proxy.embedUrl)));
      if (!isCandidate || proxy.cancelled) {
        if (sessionId) {
          try { await proxy.client.send("Runtime.runIfWaitingForDebugger", {}, sessionId); } catch {}
        }
        return;
      }
      proxy.sessions.add(sessionId);
      proxy.sessionInfo.set(sessionId, { targetId: event.targetInfo.targetId, active: false });
      try {
        await proxy.client.send("Fetch.enable", {
          patterns: [{ urlPattern: isPreviewTarget ? "*" : `${proxy.embedUrl}*`, requestStage: "Request" }],
        }, sessionId);
        if (proxy.allowedFrameId === event.targetInfo.targetId) {
          await activateAssetConsoleSession(proxy, sessionId);
        }
      } catch {}
      try { await proxy.client.send("Runtime.runIfWaitingForDebugger", {}, sessionId); } catch {}
    });
    proxy.removePausedListener = proxy.client.on("Fetch.requestPaused", (event, meta) => {
      proxyAssetConsoleRequest(event, meta.sessionId, proxy).catch(() => {});
    });

    try {
      await proxy.client.send("Target.setAutoAttach", {
        autoAttach: true,
        waitForDebuggerOnStart: true,
        flatten: true,
      });
      if (proxy.cancelled || generation !== assetConsoleRequestGeneration) {
        await disposeAssetConsoleProxy(proxy);
        return null;
      }
      await proxy.client.send("Fetch.enable", {
        patterns: [{ urlPattern: `${proxy.embedUrl}*`, requestStage: "Request" }],
      });
      if (proxy.cancelled || generation !== assetConsoleRequestGeneration) {
        await disposeAssetConsoleProxy(proxy);
        return null;
      }
      return proxy;
    } catch (error) {
      const cancelled = proxy.cancelled || generation !== assetConsoleRequestGeneration;
      await disposeAssetConsoleProxy(proxy);
      if (cancelled) return null;
      throw error;
    }
  });
}

async function teardownAssetConsoleProxy() {
  const proxy = assetConsoleProxy;
  if (proxy) proxy.cancelled = true;
  return queueAssetConsoleProxyWork(async () => {
    if (proxy) await disposeAssetConsoleProxy(proxy);
  });
}

async function handleDefaultSkillsBinding(payload) {
  let message;
  try { message = JSON.parse(payload); } catch { return; }
  const threadId = normalizeTaskId(message?.threadId);
  if (!threadId || typeof message.requestId !== 'string' || !['add', 'remove'].includes(message.action)) return;
  const target = client;
  const result = { threadId, requestId: message.requestId };
  try {
    const active = await target.evaluate("window.__codexConversationPreviewInjection__?.getDefaultSkillsTask?.() || null");
    if (active?.threadId !== threadId) return;
    const entry = message.action === 'add'
      ? active.entries?.find(item => item.path === message.entry?.path && item.name === message.entry?.name && item.enabled !== false)
      : null;
    if (message.action === 'add' && !entry) throw Error('技能目录已变化，请刷新后选择。');
    const cwd = repository.overviewCache.get(threadId)?.cwd;
    if (!cwd) throw Error('当前任务目录暂不可用，请稍后重试。');
    result.data = updateTaskSkillDefaults({ threadId, cwd, codexHome: repository.codexHome, action: message.action, entry, value: message.value });
  } catch (error) { result.error = error.message; }
  await target.evaluate(`window.__codexConversationPreviewInjection__?.setSkillDefaults?.(${JSON.stringify(result)})`);
}

async function handlePromptDepthBinding(payload) {
  let message;
  try { message = JSON.parse(payload); } catch { return; }
  const threadId = normalizeTaskId(message?.threadId);
  if (!threadId || typeof message.requestId !== 'string' || !['none', 'fast', 'standard', 'full'].includes(message.mode)) return;
  const complexity = TASK_PROMPT_COMPLEXITY_VALUES.includes(message.complexity) ? message.complexity : 'high';
  const target = client;
  const result = { threadId, requestId: message.requestId, mode: message.mode, complexity };
  try {
    const active = await target.evaluate("window.__codexConversationPreviewInjection__?.getPromptDepthTask?.() || null");
    if (active?.threadId !== threadId) return;
    const cwd = repository.overviewCache.get(threadId)?.cwd;
    if (!cwd) throw Error('当前任务目录暂不可用，请稍后重试。');
    result.data = updateTaskPromptDepth({ threadId, cwd, codexHome: repository.codexHome, mode: message.mode, complexity });
  } catch (error) { result.error = error.message; }
  await target.evaluate(`window.__codexConversationPreviewInjection__?.setPromptDepth?.(${JSON.stringify(result)})`);
}


async function handleAssetConsoleBinding(payload, forcedService = "") {
  let message = {};
  try { message = JSON.parse(payload || "{}"); } catch {}
  const panelKind = forcedService === "skill" || message.panel === "skill" ? "skill" : message.panel === "operations" ? "operations" : "asset";
  const panelLabel = panelKind === "operations" ? "专项运营" : panelKind === "skill" ? "技能管理" : "资产库";
  const generation = ++assetConsoleRequestGeneration;
  if (message.action === "close") {
    await teardownAssetConsoleProxy();
    return;
  }
  try {
    if (panelKind === "skill") await ensureSkillConsoleServer();
    else if (panelKind === "asset") await ensureAssetConsoleServer();
    if (generation !== assetConsoleRequestGeneration) return;
    const proxy = await setupAssetConsoleProxy(generation, panelKind);
    if (!proxy) return;
    if (generation !== assetConsoleRequestGeneration) return;
    const embedUrl = new URL(proxy.embedUrl);
    embedUrl.searchParams.set("embed", "codex");
    embedUrl.searchParams.set("panel", panelKind);
    if (typeof message.threadId === "string" && message.threadId.length <= 160) {
      embedUrl.searchParams.set("threadId", message.threadId);
    }
    if (typeof message.threadTitle === "string" && message.threadTitle.length <= 300) {
      embedUrl.searchParams.set("threadTitle", message.threadTitle);
    }
    if (message.theme === "light" || message.theme === "dark") {
      embedUrl.searchParams.set("theme", message.theme);
    }
    await client.evaluate(`window.__codexConversationPreviewInjection__?.setAssetConsolePanel?.(${JSON.stringify({
      state: "ready",
      url: embedUrl.href,
      panel: panelKind,
      label: panelLabel,
    })})`);
  } catch (error) {
    if (generation !== assetConsoleRequestGeneration) return;
    await teardownAssetConsoleProxy();
    try {
      await client.evaluate(`window.__codexConversationPreviewInjection__?.setAssetConsolePanel?.(${JSON.stringify({
        state: "error",
        panel: panelKind,
        label: panelLabel,
        message: error?.message || `${panelLabel}加载失败`,
      })})`);
    } catch {}
  }
}

async function bindAssetConsole({ resetBinding = true } = {}) {
  if (resetBinding) {
    removeBindingListener?.();
    removeBindingListener = null;
    removeDefaultSkillsListener?.();
    removeDefaultSkillsListener = null;
    removePromptDepthListener?.();
    removePromptDepthListener = null;
  }
  if (!removeDefaultSkillsListener) {
    await client.send("Runtime.enable");
    try { await client.send("Runtime.removeBinding", { name: DEFAULT_SKILLS_BINDING }); } catch {}
    await client.send("Runtime.addBinding", { name: DEFAULT_SKILLS_BINDING });
    removeDefaultSkillsListener = client.on("Runtime.bindingCalled", ({ name, payload, executionContextId }) => {
      if (name !== DEFAULT_SKILLS_BINDING) return;
      const target = client;
      target.send("Runtime.evaluate", {
        contextId: executionContextId,
        expression: "window === window.top && location.protocol === 'app:'",
        returnByValue: true,
      }).then(result => {
        if (client === target && result.result?.value === true) return handleDefaultSkillsBinding(payload);
      }).catch(() => {});
    });
  }
  const assetAvailable = Boolean(assetConsoleServer && existsSync(assetConsoleServer));
  ensureSkillConsoleServer().catch(() => {});
  const operationsAvailable = false;
  if ((assetAvailable || operationsAvailable) && (resetBinding || !removeBindingListener)) {
    await client.send("Runtime.enable");
    try { await client.send("Runtime.removeBinding", { name: ASSET_CONSOLE_BINDING }); } catch {}
    await client.send("Runtime.addBinding", { name: ASSET_CONSOLE_BINDING });
    removeBindingListener = client.on("Runtime.bindingCalled", ({ name, payload }) => {
      if (name === ASSET_CONSOLE_BINDING) handleAssetConsoleBinding(payload).catch(() => {});
    });
  }
  if (!removePromptDepthListener) {
    await client.send("Runtime.enable");
    try { await client.send("Runtime.removeBinding", { name: PROMPT_DEPTH_BINDING }); } catch {}
    await client.send("Runtime.addBinding", { name: PROMPT_DEPTH_BINDING });
    removePromptDepthListener = client.on("Runtime.bindingCalled", ({ name, payload, executionContextId }) => {
      if (name !== PROMPT_DEPTH_BINDING) return;
      const target = client;
      target.send("Runtime.evaluate", {
        contextId: executionContextId,
        expression: "window === window.top && location.protocol === 'app:'",
        returnByValue: true,
      }).then(result => {
        if (client === target && result.result?.value === true) return handlePromptDepthBinding(payload);
      }).catch(() => {});
    });
  }
  if (resetBinding || !removeBindingListener) {
    await client.send("Runtime.enable");
    try { await client.send("Runtime.removeBinding", { name: SKILL_CONSOLE_BINDING }); } catch {}
    await client.send("Runtime.addBinding", { name: SKILL_CONSOLE_BINDING });
    const previous = removeBindingListener;
    const removeSkillListener = client.on("Runtime.bindingCalled", ({ name, payload }) => {
      if (name === SKILL_CONSOLE_BINDING) handleAssetConsoleBinding(payload, "skill").catch(() => {});
    });
    removeBindingListener = () => { previous?.(); removeSkillListener?.(); };
  }
  await client.evaluate(`window.__codexConversationPreviewInjection__?.setAssetConsole?.(${JSON.stringify({
    available: assetAvailable || operationsAvailable,
    assetAvailable,
    operationsAvailable,
    label: "资产库",
    mode: "embedded",
  })})`);
  await client.evaluate(`window.__codexConversationPreviewInjection__?.setSkillConsole?.(${JSON.stringify({ available: true, label: "技能", mode: "embedded" })})`);
}

function localServiceHeaders(headers = {}) {
  const result = { ...headers, host: "127.0.0.1" };
  const blocked = new Set(["origin", "referer", "connection", "content-length", "host"]);
  for (const name of Object.keys(result)) {
    if (blocked.has(name.toLowerCase())) delete result[name];
  }
  return result;
}

function requestLocalService({
  port,
  method = "GET",
  route = "/",
  headers = {},
  body = null,
  timeoutMs = 15_000,
  maxResponseBytes = 16 * 1024 * 1024,
} = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const request = http.request({
      hostname: "127.0.0.1",
      port,
      path: route,
      method,
      headers: localServiceHeaders(headers),
    }, (response) => {
      response.on("error", rejectOnce);
      response.on("aborted", () => rejectOnce(new Error("Local service response was aborted")));
      const declaredLength = Number(response.headers["content-length"]);
      if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
        response.destroy(new Error(`Local service response exceeds ${maxResponseBytes} bytes`));
        return;
      }
      const chunks = [];
      let receivedBytes = 0;
      response.on("data", (chunk) => {
        receivedBytes += chunk.length;
        if (receivedBytes > maxResponseBytes) {
          response.destroy(new Error(`Local service response exceeds ${maxResponseBytes} bytes`));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        if (settled) return;
        settled = true;
        resolve({
          status: response.statusCode || 502,
          headers: response.headers,
          body: Buffer.concat(chunks, receivedBytes),
        });
      });
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error("Local service request timed out")));
    request.on("error", rejectOnce);
    if (body) request.write(body);
    request.end();
  });
}

function requestSkillConsole(options = {}) {
  return requestLocalService({ port: 4187, ...options });
}

function collapseSkillTraceEvents(events) {
  const grouped = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    const name = String(event?.skill || event?.label || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const current = grouped.get(key);
    const next = {
      ...event,
      skill: name,
      attempts: (current?.attempts || 0) + 1,
      firstTimestamp: current?.firstTimestamp || event.timestamp || null,
      recovered: Boolean(current?.recovered || (current?.status === 'failed' && event.status === 'completed')),
    };
    if (next.recovered && event.status === 'completed') {
      next.message = '此前读取失败，重试后已成功加载';
      next.reason = '';
    }
    grouped.set(key, next);
  }
  return [...grouped.values()].sort((left, right) => new Date(left.firstTimestamp || 0) - new Date(right.firstTimestamp || 0));
}

async function skillConsoleIsReady() {
  try {
    const response = await requestLocalService({ port: 4187, route: "/api/health", timeoutMs: 700 });
    return response.status >= 200 && response.status < 500;
  } catch { return false; }
}

async function ensureSkillConsoleServer() {
  if (await skillConsoleIsReady()) return;
  const serverPath = process.env.CODEX_SKILL_CONSOLE_SERVER
    || path.join(root, "src", "server.js");
  if (!existsSync(serverPath)) throw new Error("监看服务未找到");
  const child = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(path.dirname(serverPath)), detached: true, windowsHide: true,
    stdio: "ignore", env: { ...process.env, NO_PROXY: "localhost,127.0.0.1,::1", no_proxy: "localhost,127.0.0.1,::1" },
  });
  child.unref();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (await skillConsoleIsReady()) return;
  }
  throw new Error("监看服务未能启动");
}

async function attach() {
  const nextTargetId = await targetId(options.port);
  if (!await needsPreviewAttachment({ client, attachedTargetId, nextTargetId })) return false;

  if (!client || nextTargetId !== attachedTargetId) {
    assetConsoleRequestGeneration += 1;
    await teardownAssetConsoleProxy();
    client?.close();
    client = await connectMainCodex(options.port);
    removeBindingListener = null;
    removeDefaultSkillsListener?.();
    removeDefaultSkillsListener = null;
    removePromptDepthListener?.();
    removePromptDepthListener = null;
    registeredScriptIdentifier = null;
  }

  const oldIdentifier = registeredScriptIdentifier
    || await client.evaluate(`window[${JSON.stringify(SCRIPT_ID_GLOBAL)}] || null`);
  if (oldIdentifier) {
    try { await client.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: oldIdentifier }); } catch {}
  }
  const userSource = `window.__CODEX_ENHANCER_CONFIG__ = ${JSON.stringify({ skills: enhancerConfig.skills || {} })};\n${await readFile(sourcePath, "utf8")}`;
  const sourceHash = createHash("sha256").update(userSource).digest("hex");
  const markedSource = `${userSource}\n;window.__CODEX_CONVERSATION_PREVIEW_SOURCE_HASH__ = ${JSON.stringify(sourceHash)};`;
  const registered = await client.send("Page.addScriptToEvaluateOnNewDocument", { source: markedSource });
  registeredScriptIdentifier = registered.identifier;
  const sourceAlreadyActive = await client.evaluate(`Boolean(
    window.__codexConversationPreviewInjection__
    && document.getElementById("codex-conversation-preview-style")
    && window.__CODEX_CONVERSATION_PREVIEW_SOURCE_HASH__ === ${JSON.stringify(sourceHash)}
  )`);
  if (!sourceAlreadyActive) await client.evaluate(markedSource);
  await client.evaluate(`window[${JSON.stringify(SCRIPT_ID_GLOBAL)}] = ${JSON.stringify(registered.identifier)}`);
  await bindAssetConsole();
  attachedTargetId = nextTargetId;
  process.stdout.write(`Codex conversation preview attached to renderer ${nextTargetId}\n`);
  return true;
}

async function pushPreviews() {
  if (!client || !attachedTargetId) return;
  const [sidebarState, homeProjectState] = await Promise.all([
    client.evaluate(`(() => {
      const seen = new Set();
      const requests = Array.from(document.querySelectorAll('[data-app-action-sidebar-thread-row]')).flatMap((row) => {
        const id = row.getAttribute('data-app-action-sidebar-thread-id') || '';
        const title = row.getAttribute('data-app-action-sidebar-thread-title') || '';
        const key = id + '\\n' + title;
        if (seen.has(key)) return [];
        seen.add(key);
        return [{ key, id, title }];
      });
      const selected = document.querySelector('[data-app-action-sidebar-thread-id][data-app-action-sidebar-thread-selected="true"]')
        || document.querySelector('[data-app-action-sidebar-thread-id][data-selected="true"]')
        || document.querySelector('[data-app-action-sidebar-thread-id][aria-current="page"]')
        || document.querySelector('[data-app-action-sidebar-thread-id][data-active="true"]')
        || document.querySelector('[data-app-action-sidebar-thread-id][data-app-action-sidebar-thread-active="true"]');
      const routeId = location.pathname.split('/').find((part) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)) || '';
      const id = document.querySelector('[data-above-composer-conversation-id]')?.getAttribute('data-above-composer-conversation-id')
        || document.querySelector('[data-response-annotation-conversation]')?.getAttribute('data-response-annotation-conversation')
        || selected?.getAttribute('data-app-action-sidebar-thread-id')
        || routeId;
      const title = selected?.getAttribute('data-app-action-sidebar-thread-title')
        || Array.from(document.querySelectorAll('[data-testid="app-shell-header-context-menu-surface"] button'))
          .find((button) => button.offsetParent !== null)?.textContent?.trim()
        || '';
      const turnNode = document.querySelector('[data-turn-id][data-active="true"], [data-task-turn-id][data-active="true"], [data-conversation-turn-id][data-active="true"]')
        || document.querySelector('[data-turn-id]:last-of-type, [data-task-turn-id]:last-of-type, [data-conversation-turn-id]:last-of-type');
      const activeTurnId = turnNode?.getAttribute('data-turn-id')
        || turnNode?.getAttribute('data-task-turn-id')
        || turnNode?.getAttribute('data-conversation-turn-id')
        || '';
      return { requests, activeThread: { id, title }, activeTurnId };
    })()`),
    client.evaluate("window.__codexConversationPreviewInjection__?.getHomeProjectsState?.() || null"),
  ]);
  const requests = Array.isArray(sidebarState?.requests) ? sidebarState.requests : [];
  const activeThread = sidebarState?.activeThread || {};
  const [rawPreviews, rawUsage, taskboard, searchCatalog, overview, liveSnapshot] = await Promise.all([
    repository.readMany(requests),
    repository.readUsage(),
    readTaskboardSnapshot(),
    repository.readSearchCatalog(),
    repository.readOverview(activeThread.id, activeThread.title),
    requestSkillConsole({ route: "/api/overview?refresh=1", timeoutMs: 3000 }).then((response) => {
      try {
        const snapshot = JSON.parse(response.body.toString("utf8"));
        return response.status >= 200 && response.status < 300
          ? { snapshot, error: "" }
          : { snapshot: null, error: `监看服务返回 ${response.status}` };
      } catch { return { snapshot: null, error: "监看服务返回了无效数据" }; }
    }).catch((error) => ({ snapshot: null, error: error?.message || "监看服务暂时无法连接" })),
  ]);
  const activeTurnId = String(sidebarState?.activeTurnId || overview?.activeTurnId || overview?.turnId || '').trim();
  const normalizedActiveThreadId = String(activeThread.id || "").replace(/^(?:local|cloud):/i, "").toLowerCase();
  const liveSnapshotData = liveSnapshot?.snapshot || null;
  const liveRun = liveSnapshotData?.runs?.find((run) => String(run.runId).toLowerCase() === normalizedActiveThreadId)
    || (!normalizedActiveThreadId ? liveSnapshotData?.currentRun : null);
  const liveConversation = liveRun?.conversations?.find((conversation) => conversation.conversationId === activeTurnId)
    || liveRun?.conversations?.find((conversation) => conversation.conversationId === overview?.turnId)
    || liveRun?.conversations?.at(-1);
  const currentSkills = collapseSkillTraceEvents((liveRun?.skills || []).filter((skill) => !liveConversation?.conversationId || skill.conversationId === liveConversation.conversationId)).map((skill) => ({
    ...skill,
    currentTurn: Boolean(liveConversation?.conversationId && skill.conversationId === liveConversation.conversationId),
  }));
  const skillTrace = liveRun ? {
    threadId: liveRun.runId,
    status: liveConversation?.status || liveRun.status,
    updatedAt: liveRun.updatedAt,
    failureReason: liveRun.failureReason || "",
    turnId: liveConversation?.conversationId || activeTurnId || null,
    source: 'codex-session',
    scope: 'conversation',
    lastSyncAt: new Date().toISOString(),
    sourceUpdatedAt: liveSnapshotData?.generatedAt || liveRun.updatedAt || null,
    syncStatus: liveSnapshot?.error ? 'degraded' : 'connected',
    syncError: liveSnapshot?.error || '',
    skills: currentSkills,
  } : {
    threadId: normalizedActiveThreadId || null,
    status: liveSnapshot?.error ? 'unavailable' : 'idle',
    lastSyncAt: new Date().toISOString(),
    sourceUpdatedAt: null,
    syncStatus: liveSnapshot?.error ? 'disconnected' : 'connected',
    syncError: liveSnapshot?.error || '',
    skills: [],
  };
  const previews = rawPreviews.map((preview) => presentCardPreview(preview));
  const usage = presentRateLimit(rawUsage, { timeZone: "Asia/Shanghai" });
  const homeProjects = taskboard.available
    ? {
        available: true,
        message: "",
        projects: taskboard.projects,
        ...buildHomeProjectShelf({
          projects: taskboard.projects,
          tasks: taskboard.tasks,
          state: homeProjectState,
          syncedAt: new Date().toISOString(),
        }),
      }
    : {
        available: false,
        message: taskboard.message,
        projects: [],
        cards: [],
        state: homeProjectState,
      };
  await client.evaluate(`(() => {
    const api = window.__codexConversationPreviewInjection__;
    api?.setPreviews?.(${JSON.stringify(previews)});
    api?.setUsage?.(${JSON.stringify(usage)});
    api?.setHomeProjects?.(${JSON.stringify(homeProjects)});
    api?.setSearchCatalog?.(${JSON.stringify(searchCatalog)});
    api?.setThreadOverview?.(${JSON.stringify(overview)});
    api?.setSkillTrace?.(${JSON.stringify(skillTrace)});
  })()`);
  // Fallback for Codex builds where Runtime.bindingCalled can be lost after a
  // renderer reload. The page keeps the request in its loading panel, so the
  // five-second sync loop can safely replay only an unfulfilled open request.
  const pendingConsole = await client.evaluate(`(() => {
    const panel = document.querySelector("#codex-asset-console-panel[data-state=loading]");
    if (!panel || panel.querySelector("iframe")) return null;
    return { action: "open", panel: panel.dataset.consoleKind === "skill"
      ? "skill" : panel.dataset.consoleKind === "operations" ? "operations" : "asset",
      threadId: document.querySelector("[data-above-composer-conversation-id]")?.getAttribute("data-above-composer-conversation-id") || "",
      threadTitle: document.querySelector("[data-app-action-sidebar-thread-id][aria-current=page]")?.getAttribute("data-app-action-sidebar-thread-title") || "" };
  })()`);
  if (pendingConsole) await handleAssetConsoleBinding(JSON.stringify(pendingConsole));
}

function transformSkillConsoleBody(requestUrl, body, token) {
  const pathname = new URL(requestUrl).pathname;
  const prefix = assetConsoleEmbedPrefix(token);
  if (pathname === prefix || pathname === `${prefix}index.html`) {
    return Buffer.from(body.toString("utf8")
      .replaceAll('href="/', `href="${prefix}`)
      .replaceAll('src="/', `src="${prefix}`));
  }
  if (pathname === `${prefix}app.js` || pathname.endsWith(`${prefix}app.js`)) {
    const source = body.toString("utf8");
    return Buffer.from(source.startsWith("window.__SKILL_CONSOLE_EMBEDDED__")
      ? source
      : `window.__SKILL_CONSOLE_EMBEDDED__ = true;\n${source}`);
  }
  return body;
}

async function stop() {
  if (stopped) return;
  stopped = true;
  try { await client?.evaluate("window.__codexConversationPreviewInjection__?.destroy?.()") } catch {}
  assetConsoleRequestGeneration += 1;
  await teardownAssetConsoleProxy();
  removeBindingListener?.();
  removeBindingListener = null;
  removeDefaultSkillsListener?.();
  removeDefaultSkillsListener = null;
  removePromptDepthListener?.();
  removePromptDepthListener = null;
  client?.close();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await stop();
    process.exit(0);
  });
}

try {
  while (!stopped) {
    try {
      const attached = await attach();
      if (!attached) await bindAssetConsole({ resetBinding: false });
      await pushPreviews();
    } catch (error) {
      attachedTargetId = null;
      registeredScriptIdentifier = null;
      assetConsoleRequestGeneration += 1;
      await teardownAssetConsoleProxy();
      client?.close();
      client = null;
      if (!options.watch) throw error;
    }
    if (!options.watch) break;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
} finally {
  if (!options.watch) await stop();
}
