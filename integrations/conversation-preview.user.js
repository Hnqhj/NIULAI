(() => {
  "use strict";

  const SENTINEL = "__codexConversationPreviewInjection__";
  const STYLE_ID = "codex-conversation-preview-style";
  const TOGGLE_ID = "codex-conversation-view-toggle";
  const SWITCH_THUMB_CLASS = "codex-conversation-view-switch-thumb";
  const PROMPT_DEPTH_TRIGGER_ATTR = "data-codex-prompt-depth-trigger";
  const PROMPT_DEPTH_MENU_ID = "codex-prompt-depth-menu";
  const PROMPT_DEPTH_STORAGE_KEY = "codex-conversation-preview:prompt-split-depth-v1";
  const PROMPT_DEPTH_VALUES = ["none", "fast", "standard", "full"];
  const PROMPT_DEPTH_LABELS = Object.freeze({ none: "不适用", fast: "快速", standard: "普通", full: "完整" });
  const PROMPT_DEPTH_DESCRIPTIONS = Object.freeze({
    none: "不指定拆提示词模式",
    fast: "低风险内容，快速拆分",
    standard: "按常规深度拆分",
    full: "完整分析后拆分",
  });
  const PROMPT_COMPLEXITY_VALUES = ["low", "medium", "high"];
  const PROMPT_COMPLEXITY_LABELS = Object.freeze({ low: "低", medium: "中", high: "高" });
  const PROMPT_COMPLEXITY_DESCRIPTIONS = Object.freeze({
    low: "六段式 + 镜头简单描述，不限定时长",
    medium: "六段式 + 镜头时长限定 + 镜头简单描述",
    high: "六段式 + 时长限定 + 微节拍 T + 镜头复杂描述",
  });
  const SKILL_NAME_ZH = Object.freeze({
    "script-camera-group-router": "剧本镜头分组路由",
    "cinematic-audiovisual-language": "电影视听语言",
    "seedance-20": "Seedance 2.0 提示词",
    "seedance-camera": "Seedance 摄影机设计",
    "seedance-motion": "Seedance 动作设计",
    "cinematic-vfx-director": "电影级视觉特效指导",
  });
  const USAGE_ID = "codex-conversation-usage-status";
  const USAGE_TEXT_CLASS = "codex-conversation-usage-text";
  const USAGE_VALUE_CLASS = "codex-conversation-usage-value";
  const USAGE_FILL_CLASS = "codex-conversation-usage-fill";
  const SIDEBAR_CONTROLS_ID = "codex-sidebar-fixed-controls";
  const SIDEBAR_NATIVE_HEADER_STABLE_ATTR = "data-codex-sidebar-native-header-stable";
  const SHORTCUT_GRID_ID = "codex-sidebar-shortcut-grid";
  const SHORTCUT_CARD_CLASS = "codex-sidebar-shortcut-card";
  const SHORTCUT_ICON_CLASS = "codex-sidebar-shortcut-icon";
  const SHORTCUT_LABEL_CLASS = "codex-sidebar-shortcut-label";
  const PROJECT_MANAGER_ID = "codex-sidebar-project-manager";
  const ASSET_CONSOLE_PANEL_ID = "codex-asset-console-panel";
  const ASSET_CONSOLE_FRAME_ID = "codex-asset-console-frame";
  const MAIN_CONSOLE_HOST_ID = "codex-main-console-host";
  const WORKSPACE_DIM_OVERLAY_ID = "codex-workspace-modal-dim";
  const CUSTOM_WORKSPACE_ATTR = "data-codex-custom-workspace";
  const SKILL_ORGANIZER_ID = "codex-skill-organizer";
  const SKILL_FAVORITES_KEY = "codex-workspace-enhancer:skill-favorites-v1";
  const SKILL_NATIVE_SECTION_ATTR = "data-codex-skill-native-section";
  const SKILL_NATIVE_SEARCH_ATTR = "data-codex-skill-native-search";
  const SKILL_NATIVE_EXTRA_ATTR = "data-codex-skill-native-extra";
  const SECTION_TABS_ID = "codex-sidebar-section-tabs";
  const SECTION_TAB_STORAGE_KEY = "codex-conversation-preview:section-tab";
  const SECTION_NAMES = ["置顶", "项目", "最近"];
  const FOLDER_SWITCHER_ID = "codex-sidebar-folder-switcher";
  const FOLDER_STORAGE_KEY = "codex-conversation-preview:folder-id";
  const THREAD_OVERVIEW_RAIL_ID = "codex-thread-overview-rail";
  const SKILL_ACTIVITY_TRIGGER_ID = "codex-skill-activity-trigger";
  const SKILL_ACTIVITY_POPOVER_ID = "codex-skill-activity-popover";
  const COMPANY_WORKBENCH_MODE_ATTR = "data-codex-company-workbench";
  const COMPANY_OPERATIONS_WORKSTREAMS = new Set(["community", "mail", "notifications", "ambassadors", "home"]);
  const VIEW_STORAGE_KEY = "codex-conversation-preview:view-mode";
  // v3 intentionally defaults task navigation back to Codex's native-density
  // list. The v1/v2 card preferences are ignored so an earlier dashboard-like
  // layout cannot reappear after an adapter update; the user can still opt into
  // the grid with the native toggle, which then persists under this key.
  const TASK_VIEW_STORAGE_KEY = "codex-conversation-preview:task-view-mode-v3";
  const OVERVIEW_COLLAPSED_KEY = "codex-conversation-preview:overview-collapsed";
  const HOME_PROJECT_SHELF_ID = "codex-home-project-shelf";
  const HOME_PROJECT_STATE_KEY = "codex-conversation-preview:home-projects-state";
  const PROJECT_CACHE_KEY = "codex-workspace-enhancer:native-projects-v1";
  const PROJECT_APPEARANCE_KEY = "codex-workspace-enhancer:project-appearance-v1";
  const PROJECT_APPEARANCE_PICKER_ID = "codex-project-appearance-picker";
  // Keep Codex's native project data and create/manage affordance. The enhancer
  // keeps the project list in the sidebar so project navigation does not replace
  // the current task with a separate full-page project screen.
  const ENABLE_PROJECT_PAGE_ENHANCEMENTS = false;
  const SUMMARY_CLASS = "codex-conversation-core-summary";
  const DETAILS_CLASS = "codex-conversation-hover-details";
  const CARD_CONTENT_CLASS = "codex-conversation-card-content";
  const CARD_TITLE_CLASS = "codex-conversation-card-title";
  const CARD_SUMMARY_CLASS = "codex-conversation-card-summary";
  const TIME_CLASS = "codex-conversation-card-time";
  const TAGS_CLASS = "codex-conversation-card-tags";
  const ROW_SELECTOR = "[data-app-action-sidebar-thread-row]";
  const CHATGPT_ROW_SELECTOR = "[data-sidebar-chatgpt-conversation-key] [role=\"button\"]:has([data-thread-title-trigger=\"true\"])";
  const RUNTIME_TOKEN = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  try { window[SENTINEL]?.destroy?.(); } catch {}

  let destroyed = false;
  let observer = null;
  let syncTimer = null;
  let previews = new Map();
  let shortcutSources = new Map();
  let sectionSources = new Map();
  let sectionTogglePending = new Map();
  let folderSources = new Map();
  let folderTogglePending = new Map();
  let usage = {
    available: false,
    text: "剩余量 --",
    remainingPercent: null,
    tone: "muted",
    ariaLabel: "Codex 剩余量暂不可用",
  };
  let layoutAnchored = false;
  let viewMode = "card";
  let taskViewMode = "list";
  let overviewCollapsed = false;
  let activeSectionTab = null;
  let activeFolderId = null;
  let folderSearchQuery = "";
  let folderPreSearchId = null;
  let folderTagsExpanded = false;
  let searchCatalog = [];
  let searchCatalogByProject = new Map();
  let folderSearchExpansionPending = null;
  let folderSearchRevealKey = "";
  let threadOverview = null;
  let skillTrace = null;
  const skillTraceByThread = new Map();
  let skillActivityThreadId = "";
  let taskRailTab = "skills";
  let taskSkillCatalog = null;
  let taskSkillCatalogKey = "";
  let taskSkillRequestCleanup = null;
  let homeProjects = {
    available: true,
    projects: [],
    cards: [],
    message: "",
  };
  let homeProjectsState = null;
  // Keep the native project list visible in the sidebar, matching Codex's
  // built-in project-above-task hierarchy. The heading is a navigation anchor;
  // it must not collapse the project manager or replace the current task page.
  let projectManagerOpen = true;
  let projectNavigationSource = null;
  let projectNavigationCleanup = null;
  let nativeProjectCache = [];
  let projectAppearances = {};
  let projectAppearancePersistError = false;
  const projectAppearanceAbortController = new AbortController();
  let assetConsole = {
    available: false,
    assetAvailable: false,
    operationsAvailable: false,
    label: "资产库",
    mode: "embedded",
  };
  // The monitor is backed by the native Plugins page/task rail, so it remains
  // available even when the optional local dashboard service is offline.
  let skillConsole = { available: true, label: "技能", mode: "embedded" };
  let assetConsoleReturnFocus = null;
  let companyOperationsWorkstream = "";
  let operationsFrameReady = false;
  let operationsFrameNonce = "";
  let operationsPendingMessage = null;
  let skillOrganizerSource = null;
  let skillOrganizerCatalog = [];
  let skillOrganizerFilter = "常用";
  let skillOrganizerQuery = "";
  let skillOrganizerNativeVisible = false;
  let skillOrganizerExpandRequested = null;
  let skillOrganizerRenderSignature = "";
  let skillOrganizerFavorites = null;
  let skillOrganizerExpandedGroups = new Set();
  let promptDepthMenuTrigger = null;
  let promptDepthMenuCleanup = null;
  let promptDepthByThread = new Map();
  const SKILL_DESCRIPTION_OVERRIDES = new Map();
  try { viewMode = localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "card"; } catch {}
  try { taskViewMode = localStorage.getItem(TASK_VIEW_STORAGE_KEY) === "card" ? "card" : "list"; } catch {}
  try { overviewCollapsed = localStorage.getItem(OVERVIEW_COLLAPSED_KEY) === "true"; } catch {}
  try {
    const savedSectionTab = localStorage.getItem(SECTION_TAB_STORAGE_KEY);
    if (SECTION_NAMES.includes(savedSectionTab)) activeSectionTab = savedSectionTab;
  } catch {}
  try { activeFolderId = localStorage.getItem(FOLDER_STORAGE_KEY) || null; } catch {}
  try {
    const savedPromptDepth = JSON.parse(localStorage.getItem(PROMPT_DEPTH_STORAGE_KEY) || "{}");
    if (savedPromptDepth && typeof savedPromptDepth === "object" && !Array.isArray(savedPromptDepth)) {
      promptDepthByThread = new Map(Object.entries(savedPromptDepth).map(([key, value]) => {
        if (typeof key !== "string") return null;
        if (typeof value === "string" && PROMPT_DEPTH_VALUES.includes(value)) {
          return [key, { workflow: value, complexity: "high" }];
        }
        if (!value || typeof value !== "object") return null;
        const workflow = PROMPT_DEPTH_VALUES.includes(value.workflow) ? value.workflow : "none";
        const complexity = PROMPT_COMPLEXITY_VALUES.includes(value.complexity) ? value.complexity : "high";
        return [key, { workflow, complexity }];
      }).filter(Boolean));
    }
  } catch {}
  try {
    const savedHomeProjectsState = JSON.parse(localStorage.getItem(HOME_PROJECT_STATE_KEY) || "null");
    if (savedHomeProjectsState && typeof savedHomeProjectsState === "object") homeProjectsState = savedHomeProjectsState;
  } catch {}
  try {
    const savedProjects = JSON.parse(localStorage.getItem(PROJECT_CACHE_KEY) || "[]");
    if (Array.isArray(savedProjects)) nativeProjectCache = savedProjects;
  } catch {}
  try {
    const savedAppearances = JSON.parse(localStorage.getItem(PROJECT_APPEARANCE_KEY) || "{}");
    if (savedAppearances && typeof savedAppearances === "object" && !Array.isArray(savedAppearances)) {
      projectAppearances = savedAppearances;
    }
  } catch {}

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${PROMPT_DEPTH_MENU_ID} {
        position: fixed;
        z-index: 2147483000;
        width: 224px;
        max-width: min(224px, calc(100vw - 16px));
        margin: 0;
        color: inherit;
        --codex-prompt-depth-accent: #d94f70;
        transform-origin: 100% 100%;
        animation: codex-prompt-depth-in 160ms cubic-bezier(.2,.8,.2,1);
      }
      @keyframes codex-prompt-depth-in { from { opacity: 0; transform: translateY(4px) scale(.98); } to { opacity: 1; transform: none; } }
      #${PROMPT_DEPTH_MENU_ID}[hidden] { display: none !important; }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-depth-heading] { padding: 4px 10px; font-size: 13px; line-height: 18px; color: var(--color-token-text-secondary, currentColor); }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-depth-section] + [data-prompt-depth-section] { margin-top: 4px; padding-top: 4px; border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent); }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-depth-options] { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4px; padding:2px 6px 6px; }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-depth-option] {
        display: flex;
        width: 100%;
        box-sizing: border-box;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        min-height: 32px;
        padding: 6px 8px;
        border: 0;
        border-radius: 10px;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 13px;
        line-height: 17px;
        text-align: center;
        cursor: pointer;
      }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-depth-option]:hover,
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-depth-option][aria-checked="true"] {
        background: color-mix(in srgb, var(--codex-prompt-depth-accent) 14%, transparent);
        color: var(--codex-prompt-depth-accent);
      }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-depth-option]:focus-visible,
      [${PROMPT_DEPTH_TRIGGER_ATTR}]:focus-visible { outline: none; box-shadow: none; }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-depth-description] {
        overflow: hidden;
        color: color-mix(in srgb, currentColor 58%, transparent);
        font-size: 11px;
        line-height: 15px;
        text-overflow: ellipsis;
        white-space: normal;
      }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-slider-root] { position:relative; height:32px; --prompt-slider-fill-percent:100%; --prompt-slider-thumb-percent:calc(100% - 14px); }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-slider-track] { position:absolute; inset:4px 0; border-radius:999px; background:color-mix(in srgb,currentColor 12%,transparent); }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-slider-range] { position:absolute; inset:0 auto 0 0; width:var(--prompt-slider-fill-percent); border-radius:inherit; background:var(--codex-prompt-depth-accent); transition:width 180ms cubic-bezier(.2,.8,.2,1); }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-slider-ticks] { position:absolute; inset:0 13px; }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-slider-tick] { position:absolute; top:50%; width:4px; height:4px; border-radius:50%; background:color-mix(in srgb,currentColor 28%,transparent); transform:translate(-50%,-50%); }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-slider-tick]:nth-child(1) { left:0; }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-slider-tick]:nth-child(2) { left:50%; }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-slider-tick]:nth-child(3) { left:100%; }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-slider-tick][data-selected="true"] { background:color-mix(in srgb,white 70%,transparent); }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-slider-thumb] { position:absolute; top:50%; left:var(--prompt-slider-thumb-percent); width:28px; height:28px; border-radius:50%; background:white; box-shadow:0 1px 4px color-mix(in srgb,black 24%,transparent); transform:translate(-50%,-50%); transition:left 180ms cubic-bezier(.2,.8,.2,1); pointer-events:none; }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-complexity-range] { position:absolute; inset:0; width:100%; height:100%; margin:0; opacity:0; cursor:pointer; }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-slider-root]:focus-within { outline:none; }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-complexity-labels] { display:flex; justify-content:space-between; margin: 0 8px; color: color-mix(in srgb, currentColor 58%, transparent); font-size: 11px; }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-complexity-description] { margin: 6px 10px 0; color: color-mix(in srgb, currentColor 58%, transparent); font-size: 11px; line-height: 15px; }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-depth-note] { margin: 8px 10px 5px; color: color-mix(in srgb, currentColor 48%, transparent); font-size: 11px; line-height: 15px; }
      #${PROMPT_DEPTH_MENU_ID} [data-prompt-complexity-slider] { padding: 5px 10px 0; }
      [${PROMPT_DEPTH_TRIGGER_ATTR}] { flex: 0 0 auto; }
      [data-codex-conversation-preview-enhanced="true"] {
        height: auto !important;
        min-height: 48px !important;
        padding-top: 5px !important;
        padding-bottom: 5px !important;
      }
      /* Share one width across the panel and native page header. The native
         toggle still owns collapsing; persisted resize widths do not. */
      html { --codex-fixed-sidebar-width: 460px; }
      html:has([data-app-shell-sidebar-trigger][aria-expanded="false"]) {
        --codex-fixed-sidebar-width: 0px;
      }
      .app-shell-left-panel,
      .max-w-full:has(> .app-shell-left-panel) {
        width: var(--codex-fixed-sidebar-width) !important;
        min-width: var(--codex-fixed-sidebar-width) !important;
        max-width: var(--codex-fixed-sidebar-width) !important;
        flex: 0 0 var(--codex-fixed-sidebar-width) !important;
      }
      .app-shell-left-panel > .max-w-full {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }
      /* Current Codex nests the separator inside group/panel-resizer. Hide
         that hit area too, including its extension into the title bar. */
      .app-shell-left-panel > [class~="group/panel-resizer"],
      .app-shell-left-panel > :has(> [role="separator"][aria-orientation="vertical"]),
      .app-shell-left-panel > [class*="cursor-col-resize"],
      .app-shell-left-panel > [class*="cursor-ew-resize"] {
        display: none !important;
        pointer-events: none !important;
      }
      html:has(.app-shell-left-panel) header[data-app-shell-header-layout],
      html:has(.app-shell-left-panel) .app-header-tint.pointer-events-none.fixed {
        left: var(--codex-fixed-sidebar-width) !important;
        margin-left: 0 !important;
      }
      /* The native clip wrapper otherwise lets the main view paint a square
         corner behind both Codex pages and embedded workspaces. */
      div:has(> main[data-app-shell-main-surface]) {
        border-radius: 12px 0 0 0 !important;
      }
      /* A local workspace is a first-class main view. Suppress the previous
         native page header while it is active so the two title bars never
         occupy the same layer. The application menu bar remains untouched. */
      html[${CUSTOM_WORKSPACE_ATTR}="true"] .app-header-tint.pointer-events-none.fixed,
      html[${CUSTOM_WORKSPACE_ATTR}="true"] header[data-app-shell-header-layout] {
        visibility: hidden !important;
        pointer-events: none !important;
      }
      /* Native list mode: keep Codex's original row density and surfaces. */
      html[data-codex-conversation-view="list"] [data-codex-conversation-preview-enhanced="true"] {
        min-height: 48px !important;
        height: auto !important;
        padding: 5px var(--padding-row-x, 8px) !important;
        border: 0 !important;
        border-radius: var(--radius-token-row, 8px) !important;
        background: transparent !important;
        box-shadow: none !important;
        transform: none !important;
      }
      html[data-codex-conversation-view="list"] .${CARD_CONTENT_CLASS} {
        display: none !important;
      }
      ${ROW_SELECTOR}[data-codex-sidebar-search-match="true"] {
        background: color-mix(in srgb, var(--color-accent, #2f80ed) 10%, transparent) !important;
        box-shadow: inset 3px 0 0 color-mix(in srgb, var(--color-accent, #2f80ed) 65%, transparent);
      }
      [data-codex-conversation-preview-title="true"] {
        flex-direction: column !important;
        align-items: stretch !important;
        justify-content: center !important;
        gap: 0 !important;
        min-height: 38px;
      }
      [data-codex-conversation-preview-title="true"] > [data-thread-title="true"] {
        flex: 0 0 auto !important;
        width: 100%;
        line-height: 20px;
      }
      .${SUMMARY_CLASS} {
        min-width: 0;
        max-width: 100%;
        overflow: hidden;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 62%, transparent));
        font-size: 12px;
        line-height: 16px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .${CARD_CONTENT_CLASS} {
        display: none;
      }
      html[data-codex-conversation-view="card"] [data-codex-conversation-card-grid="true"] {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        align-items: stretch;
        gap: 10px 8px !important;
      }
      html[data-codex-conversation-view="card"] [data-codex-conversation-card-grid="true"] > [data-codex-conversation-card-item="true"],
      html[data-codex-conversation-view="card"] [data-codex-conversation-card-grid="true"] > [data-codex-conversation-card-item="true"] > *,
      html[data-codex-conversation-view="card"] [data-codex-conversation-card-grid="true"] > [data-codex-conversation-card-item="true"] > * > * {
        min-width: 0 !important;
        width: 100% !important;
      }
      html[data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"] {
        position: relative;
        width: 100% !important;
        height: 168px !important;
        min-height: 168px !important;
        max-height: 168px !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden;
        scroll-margin-top: 176px;
        scroll-margin-bottom: 88px;
        border: 0.5px solid color-mix(in srgb, currentColor 10%, transparent) !important;
        border-radius: 13px !important;
        background: color-mix(in srgb, var(--color-token-main-surface-secondary, Canvas) 68%, transparent) !important;
        box-shadow: 0 7px 22px color-mix(in srgb, black 6%, transparent);
        backdrop-filter: blur(14px) saturate(112%);
        -webkit-backdrop-filter: blur(14px) saturate(112%);
      }
      html[data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"]:hover,
      html[data-codex-conversation-view="card"] ${ROW_SELECTOR}[aria-current="page"] {
        border-color: color-mix(in srgb, currentColor 17%, transparent) !important;
        background: color-mix(in srgb, var(--color-token-list-hover-background, Canvas) 76%, transparent) !important;
        box-shadow: 0 9px 26px color-mix(in srgb, black 8%, transparent);
      }
      html[data-codex-conversation-view="card"] [data-codex-conversation-preview-title="true"] {
        display: none !important;
      }
      html[data-codex-conversation-view="card"] .${CARD_CONTENT_CLASS} {
        display: grid;
        position: absolute;
        z-index: 1;
        inset: 0;
        box-sizing: border-box;
        grid-template-rows: 40px 16px 36px 24px;
        align-content: start;
        gap: 6px;
        padding: 14px;
        pointer-events: none;
      }
      .${CARD_TITLE_CLASS} {
        display: -webkit-box;
        min-width: 0;
        max-height: 40px;
        overflow: hidden;
        padding-right: 24px;
        color: var(--color-token-text-primary, var(--color-token-foreground, inherit));
        font-size: 14px;
        font-weight: 600;
        line-height: 20px;
        white-space: normal;
        overflow-wrap: anywhere;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
      }
      .${TIME_CLASS} {
        min-width: 0;
        overflow: hidden;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 58%, transparent));
        font-size: 11px;
        line-height: 16px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .${CARD_SUMMARY_CLASS} {
        display: -webkit-box;
        min-width: 0;
        height: 36px;
        overflow: hidden;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 64%, transparent));
        font-size: 12px;
        line-height: 18px;
        white-space: normal;
        overflow-wrap: anywhere;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
      }
      .${TAGS_CLASS} {
        display: grid;
        min-width: 0;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        align-items: center;
        gap: 5px;
        overflow: hidden;
      }
      .${TAGS_CLASS} > span {
        min-width: 0;
        max-width: none;
        overflow: hidden;
        padding: 2px 5px;
        border: 0.5px solid color-mix(in srgb, currentColor 10%, transparent);
        border-radius: 999px;
        background: color-mix(in srgb, currentColor 5%, transparent);
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 68%, transparent));
        font-size: 10px;
        font-weight: 500;
        line-height: 18px;
        text-align: center;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      [data-codex-sidebar-shortcut-source-hidden="true"],
      [data-codex-sidebar-shortcut-source-group-hidden="true"] {
        display: none !important;
      }
      [${SIDEBAR_NATIVE_HEADER_STABLE_ATTR}="true"] {
        min-height: 44px !important;
      }
      #${SIDEBAR_CONTROLS_ID} {
        display: flex !important;
        width: 100%;
        min-width: 0;
        flex: 0 0 auto;
        flex-direction: column;
        gap: 16px;
        box-sizing: border-box;
        margin-bottom: 16px;
        padding-right: var(--codex-sidebar-scrollbar-width, 0px);
        background: var(--color-token-sidebar-surface-primary, var(--color-token-main-surface-primary, Canvas));
      }
      #${SHORTCUT_GRID_ID} {
        display: grid !important;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        grid-template-columns: repeat(var(--codex-sidebar-shortcut-columns, 5), minmax(0, 1fr));
        align-items: stretch;
        gap: 7px;
        padding: 0 var(--padding-row-x, 8px) 4px;
        background: var(--color-token-sidebar-surface-primary, var(--color-token-main-surface-primary, Canvas));
      }
      #${SHORTCUT_GRID_ID} > [data-codex-sidebar-shortcut-card-wrap] {
        position: relative;
        min-width: 0;
      }
      #${SHORTCUT_GRID_ID}[data-codex-shortcut-compact="true"] [data-codex-shortcut-more] {
        min-width: 0;
      }
      #${SHORTCUT_GRID_ID} [data-codex-shortcut-more] > summary {
        display: flex;
        width: 30px;
        height: 32px;
        align-items: center;
        justify-content: center;
        list-style: none;
        border-radius: 6px;
        color: var(--color-token-description-foreground, currentColor);
        font-size: 20px;
        cursor: pointer;
      }
      #${SHORTCUT_GRID_ID} [data-codex-shortcut-more] > summary::-webkit-details-marker { display: none; }
      #${SHORTCUT_GRID_ID} [data-codex-shortcut-more] > summary:hover {
        background: color-mix(in srgb, currentColor 6%, transparent);
      }
      #${SHORTCUT_GRID_ID} [data-codex-shortcut-more] > summary:focus-visible {
        outline: 2px solid var(--color-token-accent-foreground, Highlight);
        outline-offset: 1px;
      }
      #${SHORTCUT_GRID_ID} [data-codex-shortcut-more-items] {
        display: grid;
        position: absolute;
        z-index: 30;
        top: calc(100% + 4px);
        right: var(--padding-row-x, 8px);
        width: min(190px, calc(100% - 16px));
        grid-template-columns: minmax(0, 1fr);
        gap: 2px;
        padding: 5px;
        box-sizing: border-box;
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        border-radius: 9px;
        background: var(--color-token-sidebar-surface-primary, var(--color-token-main-surface-primary, Canvas));
        box-shadow: 0 8px 22px color-mix(in srgb, black 18%, transparent);
        max-height: min(220px, 35vh);
        overflow: auto;
      }
      #${SHORTCUT_GRID_ID} [data-codex-shortcut-more-items] > div {
        position: relative;
        min-width: 0;
      }
      #${SHORTCUT_GRID_ID} [data-codex-shortcut-more-items] .${SHORTCUT_CARD_CLASS} {
        height: 36px;
        flex-direction: row;
        justify-content: flex-start;
        gap: 6px;
        padding: 5px 8px;
        border-radius: 8px;
        box-shadow: none;
      }
      #${SHORTCUT_GRID_ID} [data-codex-shortcut-more-items] .${SHORTCUT_ICON_CLASS} {
        flex-basis: 20px;
        width: 20px;
        height: 20px;
        background: none;
      }
      #${SHORTCUT_GRID_ID} .${SHORTCUT_CARD_CLASS} {
        display: flex;
        position: relative;
        width: 100%;
        min-width: 0;
        height: 70px;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 5px;
        box-sizing: border-box;
        padding: 7px 4px 6px;
        overflow: hidden;
        border: 0.5px solid color-mix(in srgb, currentColor 10%, transparent);
        border-radius: var(--radius-token-row, 8px);
        background: color-mix(in srgb, var(--color-token-main-surface-secondary, Canvas) 72%, transparent);
        color: var(--color-token-text-primary, currentColor);
        box-shadow: none;
        cursor: pointer;
        transition: background-color 150ms ease, border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease;
      }
      #${SHORTCUT_GRID_ID} .${SHORTCUT_CARD_CLASS}:hover,
      #${SHORTCUT_GRID_ID} .${SHORTCUT_CARD_CLASS}[data-active="true"] {
        border-color: transparent;
        background: var(--color-token-list-hover-background, rgba(255,255,255,.12));
        box-shadow: none;
        transform: none;
      }
      #${SHORTCUT_GRID_ID} .${SHORTCUT_CARD_CLASS}:focus-visible,
      #${SHORTCUT_GRID_ID} [data-codex-sidebar-shortcut-quick="true"]:focus-visible {
        outline: 2px solid var(--color-token-accent-foreground, Highlight);
        outline-offset: 2px;
      }
      #${SHORTCUT_GRID_ID} .${SHORTCUT_ICON_CLASS} {
        display: inline-flex;
        flex: 0 0 28px;
        width: 28px;
        height: 28px;
        align-items: center;
        justify-content: center;
        border-radius: 9px;
        background: color-mix(in srgb, currentColor 6%, transparent);
        color: var(--color-token-text-primary, currentColor);
      }
      #${SHORTCUT_GRID_ID} .${SHORTCUT_ICON_CLASS} svg,
      #${SHORTCUT_GRID_ID} .${SHORTCUT_ICON_CLASS} img {
        display: block;
        width: 18px !important;
        height: 18px !important;
      }
      #${SHORTCUT_GRID_ID} [data-codex-sidebar-shortcut-name="技能"] .${SHORTCUT_ICON_CLASS} {
        background: color-mix(in srgb, #5fa8d3 15%, transparent);
        color: #79bde3;
      }
      #${SHORTCUT_GRID_ID} [data-codex-sidebar-shortcut-name="资产库"] .${SHORTCUT_ICON_CLASS} {
        background: color-mix(in srgb, #2f95ff 14%, transparent);
        color: #4aa4ff;
      }
      #${SHORTCUT_GRID_ID} [data-codex-sidebar-shortcut-name="专项运营"] .${SHORTCUT_ICON_CLASS} {
        background: color-mix(in srgb, #21a66f 15%, transparent);
        color: #4fd49a;
      }
      #${SHORTCUT_GRID_ID} [data-codex-sidebar-shortcut-name="技能"][data-active="true"] {
        border-color: transparent;
        background: transparent;
        color: var(--color-token-foreground, currentColor);
        box-shadow: none;
        transform: none;
      }
      #${SHORTCUT_GRID_ID} [data-codex-sidebar-shortcut-name="技能"][data-active="true"] .${SHORTCUT_LABEL_CLASS} {
        color: var(--color-token-foreground, currentColor);
      }
      #${SHORTCUT_GRID_ID} [data-codex-sidebar-shortcut-name="资产库"][data-active="true"] {
        border-color: transparent;
        background: transparent;
        color: var(--color-token-foreground, currentColor);
        box-shadow: none;
        transform: none;
      }
      #${SHORTCUT_GRID_ID} [data-codex-sidebar-shortcut-name="资产库"][data-active="true"] .${SHORTCUT_LABEL_CLASS} {
        color: var(--color-token-foreground, currentColor);
      }
      #${SHORTCUT_GRID_ID} [data-codex-sidebar-shortcut-name="专项运营"][data-active="true"] {
        border-color: color-mix(in srgb, #21a66f 38%, transparent);
        background: color-mix(in srgb, #21a66f 14%, var(--color-token-main-surface-secondary, #151515));
        color: #65dbaa;
        box-shadow: inset 0 1px 0 color-mix(in srgb, #b9ffe0 17%, transparent), 0 5px 14px color-mix(in srgb, black 10%, transparent);
        transform: none;
      }
      #${SHORTCUT_GRID_ID} [data-codex-sidebar-shortcut-name="专项运营"][data-active="true"] .${SHORTCUT_LABEL_CLASS} {
        color: #83e5bc;
      }
      /* Local entries match Codex's text-only selected state. */
      [data-codex-local-console-entry][aria-current="page"] {
        border-radius: var(--radius-token-row, 8px) !important;
        background: transparent !important;
        color: var(--color-token-list-active-selection-foreground, var(--color-token-foreground, currentColor)) !important;
        box-shadow: none !important;
      }
      [data-codex-local-console-entry][aria-current="page"] > div,
      [data-codex-local-console-entry][aria-current="page"] svg {
        color: var(--color-token-list-active-selection-foreground, var(--color-token-foreground, currentColor)) !important;
      }
      #${ASSET_CONSOLE_PANEL_ID} {
        display: grid;
        position: fixed;
        z-index: 2147482000;
        right: 0;
        bottom: 0;
        grid-template-rows: 46px minmax(0, 1fr);
        min-width: 420px;
        overflow: hidden;
        border-left: 0.5px solid color-mix(in srgb, currentColor 14%, transparent);
        background: var(--color-token-main-surface-primary, Canvas);
        color: var(--color-token-text-primary, #f5f5f5);
        box-shadow: -14px 0 36px color-mix(in srgb, black 18%, transparent);
      }
      #${ASSET_CONSOLE_PANEL_ID}[data-docked="true"] {
        position: relative;
        z-index: auto;
        inset: auto;
        width: 100%;
        min-width: 0;
        height: auto;
        min-height: 0;
        flex: 1 1 auto;
        border-left: 0;
        box-shadow: none;
      }
      #${ASSET_CONSOLE_PANEL_ID}[data-docked="true"][data-console-kind="operations"] {
        grid-template-rows: 42px minmax(0, 1fr);
        background: var(--color-token-main-surface-primary, #151515);
      }
      #${ASSET_CONSOLE_PANEL_ID}[hidden] {
        display: none;
      }
      #${ASSET_CONSOLE_PANEL_ID}[data-docked="true"] [data-codex-asset-console-close] {
        display: inline-flex;
      }
      #${ASSET_CONSOLE_PANEL_ID}[data-docked="true"] .codex-asset-console-body {
        overflow: auto;
      }
      #${MAIN_CONSOLE_HOST_ID} {
        position: absolute;
        /* Keep the embedded workspace above the document-level dim layer;
           its native dialog backdrop then dims only the page behind the card. */
        z-index: 2147483000;
        inset: 0;
        display: flex;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        /* Match Codex's main surface: only the upper-left edge is rounded
           because the workspace is flush with the window's other edges. */
        border-radius: 12px 0 0 0 !important;
        clip-path: none !important;
        background: var(--codex-console-surface, var(--color-token-main-surface-primary, Canvas));
      }
      #${MAIN_CONSOLE_HOST_ID}[data-skill-detail-open="true"]::before {
        position: absolute;
        z-index: 1;
        inset: 0;
        background: rgba(0, 0, 0, 0.30);
        content: "";
        pointer-events: none;
      }
      #${MAIN_CONSOLE_HOST_ID}[data-skill-detail-open="true"] #${ASSET_CONSOLE_PANEL_ID} { position: relative; z-index: 2; }
      #${WORKSPACE_DIM_OVERLAY_ID} {
        position: fixed;
        z-index: 2147482000;
        inset: 0;
        pointer-events: none;
      }
      #${WORKSPACE_DIM_OVERLAY_ID}[hidden] { display: none; }
      #${WORKSPACE_DIM_OVERLAY_ID} .codex-modal-dim-segment {
        position: absolute;
        background: rgba(0, 0, 0, 0.30);
        pointer-events: auto;
        cursor: default;
      }
      #${WORKSPACE_DIM_OVERLAY_ID} .codex-modal-dim-top { top: 0; right: 0; left: 0; height: var(--host-y, 0px); }
      #${WORKSPACE_DIM_OVERLAY_ID} .codex-modal-dim-bottom { right: 0; bottom: 0; left: 0; top: calc(var(--host-y, 0px) + var(--host-h, 0px)); }
      #${WORKSPACE_DIM_OVERLAY_ID} .codex-modal-dim-left { top: var(--host-y, 0px); bottom: auto; left: 0; width: var(--host-x, 0px); height: var(--host-h, 0px); }
      #${WORKSPACE_DIM_OVERLAY_ID} .codex-modal-dim-right { top: var(--host-y, 0px); right: 0; bottom: auto; left: calc(var(--host-x, 0px) + var(--host-w, 0px)); width: auto; height: var(--host-h, 0px); }
      #${MAIN_CONSOLE_HOST_ID}[data-console-switching="true"]::after {
        position: absolute;
        z-index: 3;
        inset: 0;
        background: var(--codex-console-surface, var(--color-token-main-surface-primary, Canvas));
        content: "";
        pointer-events: none;
      }
      #${MAIN_CONSOLE_HOST_ID}[data-console-switching="true"] #${ASSET_CONSOLE_PANEL_ID} { z-index: 2; }
      #${MAIN_CONSOLE_HOST_ID} #${ASSET_CONSOLE_PANEL_ID}[data-docked="true"] {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        height: 100%;
        border: 0;
      }
      #${MAIN_CONSOLE_HOST_ID} #${ASSET_CONSOLE_PANEL_ID} .codex-asset-console-header {
        min-height: 42px;
        border-bottom: 0;
        background: var(--color-token-main-surface-primary, Canvas);
      }
      /* 技能功能页与资产库页使用自身的原生式顶栏；外层容器不再重复显示标题。 */
      #${ASSET_CONSOLE_PANEL_ID}[data-workspace="true"][data-console-kind="skill"],
      #${ASSET_CONSOLE_PANEL_ID}[data-workspace="true"][data-console-kind="asset"] {
        grid-template-rows: minmax(0, 1fr);
      }
      #${ASSET_CONSOLE_PANEL_ID}[data-workspace="true"][data-console-kind="skill"] .codex-asset-console-header,
      #${ASSET_CONSOLE_PANEL_ID}[data-workspace="true"][data-console-kind="asset"] .codex-asset-console-header {
        display: none;
      }
      #${ASSET_CONSOLE_PANEL_ID} .codex-asset-console-header {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 10px;
        padding: 0 10px 0 14px;
        border-bottom: 0;
        background: color-mix(in srgb, var(--color-token-main-surface-secondary, #151515) 92%, transparent);
      }
      #${ASSET_CONSOLE_PANEL_ID} .codex-asset-console-title {
        min-width: 0;
        overflow: hidden;
        font-size: 13px;
        font-weight: 650;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${ASSET_CONSOLE_PANEL_ID} .codex-asset-console-local {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 5px;
        color: var(--color-token-description-foreground, #a7a7a7);
        font-size: 10px;
      }
      #${ASSET_CONSOLE_PANEL_ID} .codex-asset-console-local::before {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #35b66f;
        content: "";
      }
      #${ASSET_CONSOLE_PANEL_ID} .codex-asset-console-spacer {
        flex: 1 1 auto;
      }
      #${ASSET_CONSOLE_PANEL_ID} .codex-asset-console-action {
        display: inline-flex;
        width: 30px;
        height: 30px;
        flex: 0 0 30px;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--color-token-description-foreground, #b6b6b6);
        cursor: pointer;
      }
      #${ASSET_CONSOLE_PANEL_ID} .codex-asset-console-action:hover {
        background: color-mix(in srgb, currentColor 9%, transparent);
        color: var(--color-token-text-primary, white);
      }
      #${ASSET_CONSOLE_PANEL_ID} .codex-asset-console-action:focus-visible {
        outline: 2px solid var(--color-token-accent-foreground, Highlight);
        outline-offset: 1px;
      }
      #${ASSET_CONSOLE_PANEL_ID}[data-console-kind="operations"] .codex-asset-console-header {
        gap: 7px;
        padding: 0 8px 0 10px;
        background: var(--color-token-main-surface-secondary, #191919);
      }
      #${ASSET_CONSOLE_PANEL_ID}[data-console-kind="operations"] .codex-asset-console-title {
        font-size: 12px;
        font-weight: 680;
      }
      #${ASSET_CONSOLE_PANEL_ID}[data-console-kind="operations"] .codex-asset-console-local {
        font-size: 9px;
      }
      #${ASSET_CONSOLE_PANEL_ID}[data-console-kind="operations"] .codex-asset-console-action {
        width: 27px;
        height: 27px;
        flex-basis: 27px;
        border-radius: 6px;
      }
      #${ASSET_CONSOLE_PANEL_ID} .codex-asset-console-body {
        display: grid;
        position: relative;
        min-width: 0;
        min-height: 0;
        place-items: center;
        overflow: hidden;
        background: var(--codex-console-surface, var(--color-token-main-surface-primary, Canvas));
      }
      #${ASSET_CONSOLE_FRAME_ID} {
        opacity: 1;
        transition: opacity 110ms ease-out;
      }
      #${ASSET_CONSOLE_PANEL_ID}[data-state="loading"] #${ASSET_CONSOLE_FRAME_ID} {
        opacity: 0;
      }
      #${ASSET_CONSOLE_PANEL_ID}[data-console-kind="operations"] .codex-asset-console-body,
      #${ASSET_CONSOLE_PANEL_ID}[data-console-kind="operations"] #${ASSET_CONSOLE_FRAME_ID} {
        background: var(--codex-console-surface, var(--color-token-main-surface-primary, #151515));
      }
      #${ASSET_CONSOLE_PANEL_ID} .codex-asset-console-state {
        display: grid;
        max-width: 360px;
        justify-items: center;
        gap: 10px;
        padding: 24px;
        color: color-mix(in srgb, currentColor 70%, transparent);
        font-size: 12px;
        line-height: 18px;
        text-align: center;
      }
      #${ASSET_CONSOLE_PANEL_ID} .codex-asset-console-spinner {
        width: 22px;
        height: 22px;
        border: 2px solid color-mix(in srgb, currentColor 18%, transparent);
        border-top-color: #4aa4ff;
        border-radius: 50%;
        animation: codex-asset-console-spin 800ms linear infinite;
      }
      #${ASSET_CONSOLE_PANEL_ID}[data-console-kind="operations"] .codex-asset-console-spinner {
        border-top-color: #36b982;
      }
      #${ASSET_CONSOLE_PANEL_ID}[data-state="error"] .codex-asset-console-spinner {
        display: none;
      }
      #${ASSET_CONSOLE_PANEL_ID} .codex-asset-console-retry {
        display: none;
        padding: 6px 11px;
        border: 0.5px solid color-mix(in srgb, currentColor 16%, transparent);
        border-radius: 8px;
        background: color-mix(in srgb, currentColor 7%, transparent);
        color: inherit;
        cursor: pointer;
      }
      #${ASSET_CONSOLE_PANEL_ID}[data-state="error"] .codex-asset-console-retry {
        display: inline-flex;
      }
      #${ASSET_CONSOLE_FRAME_ID} {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
        background: var(--codex-console-surface, var(--color-token-main-surface-primary, Canvas));
      }
      @keyframes codex-asset-console-spin { to { transform: rotate(360deg); } }
      #${SHORTCUT_GRID_ID} .${SHORTCUT_LABEL_CLASS} {
        display: block;
        width: 100%;
        min-width: 0;
        overflow: hidden;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 72%, transparent));
        font-size: 11px;
        font-weight: 550;
        line-height: 14px;
        text-align: center;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${SHORTCUT_GRID_ID} .codex-sidebar-shortcut-status {
        position: absolute;
        z-index: 2;
        top: 7px;
        right: 7px;
        width: 6px;
        height: 6px;
        border: 2px solid var(--color-token-main-surface-primary, Canvas);
        border-radius: 50%;
        background: var(--vscode-textLink-foreground, #2f95ff);
        pointer-events: none;
      }
      #${SHORTCUT_GRID_ID} [data-codex-sidebar-shortcut-quick="true"] {
        display: inline-flex;
        position: absolute;
        z-index: 3;
        top: 4px;
        right: 4px;
        width: 20px;
        height: 20px;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 0.5px solid color-mix(in srgb, currentColor 12%, transparent);
        border-radius: 7px;
        background: color-mix(in srgb, var(--color-token-main-surface-primary, Canvas) 88%, transparent);
        color: var(--color-token-description-foreground, currentColor);
        box-shadow: 0 1px 4px color-mix(in srgb, black 7%, transparent);
        cursor: pointer;
      }
      #${SHORTCUT_GRID_ID} [data-codex-sidebar-shortcut-quick="true"]:hover {
        background: var(--color-token-list-hover-background, Canvas);
        color: var(--color-token-text-primary, currentColor);
      }
      #${SHORTCUT_GRID_ID} [data-codex-sidebar-shortcut-quick="true"] svg {
        width: 12px !important;
        height: 12px !important;
      }
      [data-codex-sidebar-section-heading-hidden="true"] {
        display: none !important;
      }
      #${PROJECT_MANAGER_ID} {
        display: flex;
        flex: 0 0 auto;
        min-width: 0;
        flex-direction: column;
        gap: 2px;
        margin: 2px 8px 8px;
        padding: 4px 0;
        border-top: 1px solid color-mix(in srgb, currentColor 9%, transparent);
        border-bottom: 1px solid color-mix(in srgb, currentColor 9%, transparent);
      }
      #${PROJECT_MANAGER_ID}[hidden] { display: none !important; }
      #${PROJECT_MANAGER_ID} [data-codex-sidebar-project-manager-header] {
        display: flex;
        min-width: 0;
        align-items: center;
        justify-content: space-between;
        padding: 4px 8px 3px;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 62%, transparent));
        font-size: 11px;
        line-height: 16px;
      }
      #${PROJECT_MANAGER_ID} [data-codex-sidebar-project-list] {
        display: flex;
        min-width: 0;
        max-height: min(300px, 32vh);
        flex-direction: column;
        gap: 1px;
        overflow: auto;
      }
      #${PROJECT_MANAGER_ID} [data-codex-sidebar-project-entry] {
        display: flex;
        min-width: 0;
        min-height: 30px;
        align-items: center;
        gap: 7px;
        box-sizing: border-box;
        padding: 5px 8px;
        border: 0;
        border-radius: 7px;
        background: transparent;
        color: var(--color-token-foreground, inherit);
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      #${PROJECT_MANAGER_ID} [data-codex-sidebar-project-entry]:hover {
        background: var(--color-token-list-hover-background, color-mix(in srgb, currentColor 6%, transparent));
      }
      #${PROJECT_MANAGER_ID} [data-codex-sidebar-project-entry]:focus-visible {
        outline: 2px solid var(--color-token-accent-foreground, Highlight);
        outline-offset: -2px;
      }
      #${PROJECT_MANAGER_ID} [data-codex-sidebar-project-entry] svg {
        flex: 0 0 15px;
        color: var(--color-token-description-foreground, currentColor);
      }
      #${PROJECT_MANAGER_ID} [data-codex-sidebar-project-copy] {
        display: flex;
        min-width: 0;
        flex: 1 1 auto;
        flex-direction: column;
        gap: 1px;
      }
      #${PROJECT_MANAGER_ID} [data-codex-sidebar-project-name] {
        min-width: 0;
        overflow: hidden;
        color: var(--color-token-foreground, inherit);
        font-size: 12px;
        line-height: 16px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${PROJECT_MANAGER_ID} [data-codex-sidebar-project-meta] {
        min-width: 0;
        overflow: hidden;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 58%, transparent));
        font-size: 10px;
        line-height: 14px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${PROJECT_MANAGER_ID} [data-codex-sidebar-project-empty] {
        padding: 7px 8px;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 60%, transparent));
        font-size: 11px;
        line-height: 16px;
      }
      [data-codex-project-custom-icon="true"] {
        position: relative !important;
        color: var(--codex-project-icon-color, currentColor) !important;
      }
      [data-codex-project-custom-icon="true"] > :not([data-codex-project-custom-icon-overlay]) {
        visibility: hidden !important;
      }
      [data-codex-project-custom-icon-overlay] {
        display: inline-flex;
        position: absolute;
        inset: 0;
        align-items: center;
        justify-content: center;
        color: var(--codex-project-icon-color, currentColor);
        pointer-events: none;
      }
      #${PROJECT_APPEARANCE_PICKER_ID} {
        display: flex;
        position: fixed;
        z-index: 2147483646;
        width: 276px;
        box-sizing: border-box;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        border-radius: 12px;
        background: var(--color-token-dropdown-background, var(--color-token-main-surface-primary, Canvas));
        color: var(--color-token-text-primary, CanvasText);
        box-shadow: 0 12px 32px color-mix(in srgb, black 18%, transparent), 0 2px 8px color-mix(in srgb, black 9%, transparent);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        user-select: none;
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-header] {
        display: flex;
        min-width: 0;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-preview] {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 550;
        line-height: 20px;
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-preview-icon] {
        display: inline-flex;
        width: 24px;
        height: 24px;
        flex: 0 0 24px;
        align-items: center;
        justify-content: center;
        border-radius: 7px;
        background: color-mix(in srgb, var(--codex-project-icon-color, currentColor) 10%, transparent);
        color: var(--codex-project-icon-color, currentColor);
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-name] {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-close],
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-icon],
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-color] {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-close] {
        width: 26px;
        height: 26px;
        flex: 0 0 26px;
        border-radius: 8px;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 60%, transparent));
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-close]:hover,
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-icon]:hover {
        background: var(--color-token-list-hover-background, color-mix(in srgb, currentColor 7%, transparent));
        color: var(--color-token-text-primary, currentColor);
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-section] {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-label] {
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 62%, transparent));
        font-size: 11px;
        line-height: 16px;
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-icons] {
        display: grid;
        grid-template-columns: repeat(6, 32px);
        gap: 6px;
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-icon] {
        width: 32px;
        height: 32px;
        border-radius: 9px;
        color: var(--codex-project-icon-color, currentColor);
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-icon][aria-pressed="true"] {
        background: color-mix(in srgb, var(--codex-project-icon-color, currentColor) 13%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--codex-project-icon-color, currentColor) 25%, transparent);
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-colors] {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-color] {
        position: relative;
        width: 24px;
        height: 24px;
        border-radius: 999px;
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-color]::before {
        width: 16px;
        height: 16px;
        box-sizing: border-box;
        border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
        border-radius: inherit;
        background: var(--project-color-swatch, transparent);
        content: "";
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-color=""]::after {
        position: absolute;
        width: 14px;
        border-top: 1.5px solid currentColor;
        content: "";
        opacity: .55;
        transform: rotate(-45deg);
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-color][aria-pressed="true"] {
        box-shadow: 0 0 0 2px var(--color-token-main-surface-primary, Canvas), 0 0 0 3px color-mix(in srgb, currentColor 52%, transparent);
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-custom-color] {
        display: inline-flex;
        position: relative;
        width: 24px;
        height: 24px;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 999px;
        background: conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ef4444);
        cursor: pointer;
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-custom-color]::after {
        width: 10px;
        height: 10px;
        border: 2px solid var(--color-token-main-surface-primary, Canvas);
        border-radius: inherit;
        content: "";
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-custom-color] input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-footer] {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding-top: 2px;
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-save-error] {
        color: var(--color-token-text-danger, #d04f4f);
        font-size: 10px;
        line-height: 14px;
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-save-error][hidden] { display: none; }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-reset] {
        height: 28px;
        padding: 0 9px;
        border: 0;
        border-radius: 9px;
        background: transparent;
        color: var(--color-token-description-foreground, currentColor);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
      }
      #${PROJECT_APPEARANCE_PICKER_ID} [data-project-appearance-reset]:hover {
        background: var(--color-token-list-hover-background, color-mix(in srgb, currentColor 7%, transparent));
        color: var(--color-token-text-primary, currentColor);
      }
      #${PROJECT_APPEARANCE_PICKER_ID} button:focus-visible,
      #${PROJECT_APPEARANCE_PICKER_ID} input:focus-visible {
        outline: 2px solid var(--color-token-accent-foreground, Highlight);
        outline-offset: 1px;
      }
      #${SECTION_TABS_ID} {
        display: grid !important;
        flex: 0 0 auto;
        grid-template-columns: minmax(0, 1fr) 58px;
        align-items: center;
        gap: 6px;
        box-sizing: border-box;
        min-width: 0;
        min-height: 42px;
        margin: 4px 8px;
        padding: 4px;
        border: 0.5px solid color-mix(in srgb, currentColor 10%, transparent);
        border-radius: 12px;
        background: var(--color-token-main-surface-secondary, Canvas);
        box-shadow: inset 0 1px 0 color-mix(in srgb, white 22%, transparent), 0 4px 14px color-mix(in srgb, black 4%, transparent);
      }
      #${SECTION_TABS_ID} [role="tablist"] {
        display: grid;
        min-width: 0;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        align-items: center;
        gap: 3px;
      }
      #${SECTION_TABS_ID} [role="tab"] {
        display: inline-flex;
        min-width: 0;
        height: 32px;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        padding: 0 8px;
        overflow: hidden;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 64%, transparent));
        font-size: 12px;
        font-weight: 560;
        line-height: 18px;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
        transition: color 150ms ease, background-color 150ms ease, box-shadow 150ms ease;
      }
      #${SECTION_TABS_ID} [role="tab"]:hover {
        color: var(--color-token-text-primary, currentColor);
        background: color-mix(in srgb, currentColor 5%, transparent);
      }
      #${SECTION_TABS_ID} [role="tab"][aria-selected="true"] {
        background: color-mix(in srgb, var(--color-token-main-surface-primary, Canvas) 88%, transparent);
        color: var(--color-token-text-primary, currentColor);
        box-shadow: 0 1px 4px color-mix(in srgb, black 10%, transparent), inset 0 0 0 0.5px color-mix(in srgb, currentColor 8%, transparent);
      }
      #${SECTION_TABS_ID} [role="tab"]:focus-visible,
      #${SECTION_TABS_ID} [data-codex-sidebar-project-actions] button:focus-visible {
        outline: 2px solid var(--color-token-accent-foreground, Highlight) !important;
        outline-offset: 1px !important;
      }
      #${SECTION_TABS_ID} [data-codex-sidebar-project-actions] {
        display: flex;
        width: 58px;
        height: 32px;
        align-items: center;
        justify-content: flex-end;
        gap: 2px;
      }
      #${SECTION_TABS_ID} [data-codex-sidebar-project-actions][hidden] {
        display: none !important;
      }
      #${SECTION_TABS_ID} [data-codex-sidebar-project-actions] [data-codex-sidebar-project-actions-source] {
        display: flex !important;
        align-items: center;
        gap: 2px !important;
      }
      #${SECTION_TABS_ID} [data-codex-sidebar-project-actions] [data-codex-sidebar-project-actions-source] > *,
      #${SECTION_TABS_ID} [data-codex-sidebar-project-actions] [data-codex-sidebar-project-actions-source] > * > * {
        pointer-events: auto !important;
        opacity: 1 !important;
      }
      #${SECTION_TABS_ID} [data-codex-sidebar-project-actions] button {
        width: 26px !important;
        height: 26px !important;
        min-width: 26px !important;
        min-height: 26px !important;
        padding: 3px !important;
        border-radius: 8px !important;
      }
      #${SECTION_TABS_ID} [data-codex-sidebar-project-actions] svg {
        width: 17px !important;
        height: 17px !important;
      }
      [data-codex-sidebar-folder-heading-hidden="true"] {
        display: none !important;
      }
      #${FOLDER_SWITCHER_ID} {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 8px;
        box-sizing: border-box;
        margin: 2px 0 10px;
        padding: 9px;
        border: 0.5px solid color-mix(in srgb, currentColor 9%, transparent);
        border-radius: 13px;
        background: color-mix(in srgb, var(--color-token-main-surface-secondary, Canvas) 63%, transparent);
        box-shadow: inset 0 1px 0 color-mix(in srgb, white 20%, transparent), 0 4px 14px color-mix(in srgb, black 3%, transparent);
        backdrop-filter: blur(13px) saturate(110%);
        -webkit-backdrop-filter: blur(13px) saturate(110%);
      }
      #${FOLDER_SWITCHER_ID} .codex-sidebar-folder-search-row {
        display: grid;
        min-width: 0;
        grid-template-columns: minmax(0, 1fr) 58px;
        align-items: center;
        gap: 6px;
      }
      #${FOLDER_SWITCHER_ID} .codex-sidebar-folder-search-shell {
        position: relative;
        min-width: 0;
      }
      #${FOLDER_SWITCHER_ID} .codex-sidebar-folder-search-icon {
        display: inline-flex;
        position: absolute;
        z-index: 1;
        top: 50%;
        left: 10px;
        align-items: center;
        justify-content: center;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 58%, transparent));
        pointer-events: none;
        transform: translateY(-50%);
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-search] {
        width: 100%;
        min-width: 0;
        height: 34px;
        box-sizing: border-box;
        padding: 0 32px;
        border: 0.5px solid color-mix(in srgb, currentColor 11%, transparent);
        border-radius: 10px;
        outline: 0;
        background: color-mix(in srgb, var(--color-token-main-surface-primary, Canvas) 80%, transparent);
        color: var(--color-token-text-primary, currentColor);
        box-shadow: inset 0 1px 2px color-mix(in srgb, black 3%, transparent);
        font-size: 12px;
        line-height: 18px;
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-search]::placeholder {
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 52%, transparent));
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-search]:focus-visible {
        border-color: color-mix(in srgb, var(--color-token-accent-foreground, currentColor) 38%, transparent);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-token-accent-foreground, Highlight) 14%, transparent);
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-clear] {
        display: inline-flex;
        position: absolute;
        z-index: 2;
        top: 50%;
        right: 5px;
        width: 24px;
        height: 24px;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 0;
        border-radius: 7px;
        background: transparent;
        color: var(--color-token-description-foreground, currentColor);
        cursor: pointer;
        transform: translateY(-50%);
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-clear]:hover {
        background: color-mix(in srgb, currentColor 7%, transparent);
        color: var(--color-token-text-primary, currentColor);
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-actions] {
        display: flex;
        width: 58px;
        height: 32px;
        align-items: center;
        justify-content: flex-end;
        gap: 2px;
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-actions][hidden] {
        display: none !important;
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-actions-source] {
        display: flex !important;
        width: auto !important;
        max-width: none !important;
        align-items: center;
        gap: 2px !important;
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-actions-source] > *,
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-actions-source] > * > *,
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-actions-source] > * > * > * {
        width: auto !important;
        overflow: visible !important;
        pointer-events: auto !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-actions] button {
        width: 26px !important;
        height: 26px !important;
        min-width: 26px !important;
        min-height: 26px !important;
        padding: 3px !important;
        border-radius: 8px !important;
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-actions] svg {
        width: 17px !important;
        height: 17px !important;
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-tags] {
        display: grid;
        min-width: 0;
        max-height: 62px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        align-items: start;
        gap: 6px;
        overflow: hidden;
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-tags][data-expanded="true"] {
        max-height: none;
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-tag] {
        display: inline-flex;
        min-width: 0;
        height: 28px;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        padding: 0 10px;
        overflow: hidden;
        border: 0.5px solid color-mix(in srgb, currentColor 10%, transparent);
        border-radius: 999px;
        background: color-mix(in srgb, var(--color-token-main-surface-primary, Canvas) 66%, transparent);
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 67%, transparent));
        font-size: 11px;
        font-weight: 520;
        line-height: 18px;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
        transition: color 140ms ease, border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease;
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-tag]:hover {
        border-color: color-mix(in srgb, currentColor 18%, transparent);
        background: color-mix(in srgb, var(--color-token-list-hover-background, Canvas) 82%, transparent);
        color: var(--color-token-text-primary, currentColor);
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-tag][aria-pressed="true"] {
        border-color: color-mix(in srgb, var(--color-token-accent-foreground, currentColor) 24%, transparent);
        background: color-mix(in srgb, var(--color-token-accent-foreground, currentColor) 10%, var(--color-token-main-surface-primary, Canvas));
        color: var(--color-token-text-primary, currentColor);
        box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--color-token-accent-foreground, currentColor) 10%, transparent), 0 2px 6px color-mix(in srgb, black 5%, transparent);
        font-weight: 620;
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-tag]:focus-visible,
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-expand]:focus-visible,
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-clear]:focus-visible,
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-actions] button:focus-visible {
        outline: 2px solid var(--color-token-accent-foreground, Highlight) !important;
        outline-offset: 1px !important;
      }
      #${FOLDER_SWITCHER_ID} .codex-sidebar-folder-meta {
        display: flex;
        min-width: 0;
        min-height: 20px;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-result] {
        min-width: 0;
        overflow: hidden;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 56%, transparent));
        font-size: 10px;
        line-height: 16px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-expand] {
        display: inline-flex;
        flex: 0 0 auto;
        height: 22px;
        align-items: center;
        gap: 3px;
        padding: 0 6px;
        border: 0;
        border-radius: 7px;
        background: transparent;
        color: var(--color-token-description-foreground, currentColor);
        font-size: 10px;
        line-height: 16px;
        cursor: pointer;
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-expand]:hover {
        background: color-mix(in srgb, currentColor 6%, transparent);
        color: var(--color-token-text-primary, currentColor);
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-expand] svg {
        transition: transform 150ms ease;
      }
      #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-expand][aria-expanded="true"] svg {
        transform: rotate(180deg);
      }
      #${THREAD_OVERVIEW_RAIL_ID} {
        display: flex;
        width: clamp(248px, 22vw, 300px);
        min-width: 0;
        height: 100%;
        min-height: 0;
        flex: 0 0 clamp(248px, 22vw, 300px);
        flex-direction: column;
        box-sizing: border-box;
        overflow: hidden;
        border-left: 0.5px solid color-mix(in srgb, currentColor 10%, transparent);
        background: color-mix(in srgb, var(--color-token-main-surface-secondary, Canvas) 92%, transparent);
        color: var(--color-token-text-primary, currentColor);
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} {
        width: 50%;
        flex-basis: 50%;
        border-left-color: color-mix(in srgb, #21a66f 16%, currentColor 7%);
        background: color-mix(in srgb, var(--color-token-main-surface-secondary, Canvas) 94%, transparent);
      }
      #${THREAD_OVERVIEW_RAIL_ID} [data-codex-company-master-view] {
        display: flex;
        min-height: 0;
        flex: 1;
        flex-direction: column;
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} [data-codex-company-master-view] {
        min-height: 0;
        max-height: none;
        flex: 1 1 auto;
        border-bottom: 0.5px solid color-mix(in srgb, currentColor 10%, transparent);
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-company-ops-launcher {
        display: none;
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-company-ops-launcher {
        display: grid;
        min-height: 80px;
        flex: 0 0 80px;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        align-items: stretch;
        gap: 6px;
        box-sizing: border-box;
        padding: 10px;
        border-top: 0.5px solid color-mix(in srgb, currentColor 10%, transparent);
        background: color-mix(in srgb, var(--color-token-main-surface-primary, Canvas) 68%, transparent);
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-company-ops-launcher button {
        min-width: 0;
        padding: 6px 5px;
        border: 0.5px solid color-mix(in srgb, #21a66f 24%, currentColor 7%);
        border-radius: 9px;
        background: color-mix(in srgb, #21a66f 7%, transparent);
        color: inherit;
        font: inherit;
        font-size: 10px;
        font-weight: 650;
        line-height: 14px;
        cursor: pointer;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-company-ops-launcher button:hover,
      #${THREAD_OVERVIEW_RAIL_ID} .codex-company-ops-launcher button[aria-pressed="true"] {
        border-color: color-mix(in srgb, #21a66f 48%, currentColor 7%);
        background: color-mix(in srgb, #21a66f 15%, transparent);
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-company-ops-launcher button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] [data-app-action-timeline-scroll] {
        background: color-mix(in srgb, #21a66f 2%, var(--color-token-main-surface-primary, #181818));
        box-shadow: inset -1px 0 0 color-mix(in srgb, currentColor 7%, transparent);
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] [data-user-message-bubble="true"] {
        border: 0.5px solid color-mix(in srgb, #21a66f 18%, currentColor 8%);
        border-radius: 14px;
        background: color-mix(in srgb, #21a66f 6%, var(--color-token-main-surface-primary, #181818));
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] [data-codex-composer-root][data-composer-placement="thread"] [data-composer-surface-variant] {
        border-radius: 16px !important;
        background: color-mix(in srgb, #21a66f 3%, var(--color-token-main-surface-primary, #181818)) !important;
        box-shadow:
          inset 0 0 0 0.5px color-mix(in srgb, #21a66f 18%, currentColor 8%),
          0 10px 30px color-mix(in srgb, black 18%, transparent) !important;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-header {
        display: flex;
        min-height: 48px;
        align-items: center;
        gap: 8px;
        padding: 0 14px;
        border-bottom: 0.5px solid color-mix(in srgb, currentColor 8%, transparent);
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-mark {
        width: 7px;
        height: 7px;
        flex: 0 0 7px;
        border-radius: 50%;
        background: #21a66f;
        box-shadow: 0 0 0 4px color-mix(in srgb, #21a66f 12%, transparent);
      }
      #${THREAD_OVERVIEW_RAIL_ID} h2 {
        min-width: 0;
        flex: 1;
        margin: 0;
        font-size: 12px;
        font-weight: 680;
        line-height: 18px;
      }
      #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-overview-status] {
        flex: 0 0 auto;
        padding: 2px 6px;
        border-radius: 999px;
        background: color-mix(in srgb, currentColor 7%, transparent);
        color: var(--color-token-description-foreground, currentColor);
        font-size: 9px;
        line-height: 14px;
      }
      #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-overview-status][data-running="true"] {
        background: color-mix(in srgb, #21a66f 13%, transparent);
        color: color-mix(in srgb, #21a66f 78%, currentColor);
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-body {
        display: flex;
        min-height: 0;
        flex: 1;
        flex-direction: column;
        gap: 10px;
        padding: 13px;
        overflow: auto;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-title {
        margin: 0 1px 2px;
        overflow-wrap: anywhere;
        font-size: 14px;
        font-weight: 680;
        line-height: 20px;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-card {
        padding: 11px;
        border: 0.5px solid color-mix(in srgb, currentColor 8%, transparent);
        border-radius: 10px;
        background: color-mix(in srgb, var(--color-token-main-surface-primary, Canvas) 72%, transparent);
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-card[data-kind="next"] {
        border-color: color-mix(in srgb, #21a66f 24%, currentColor 6%);
        background: color-mix(in srgb, #21a66f 6%, var(--color-token-main-surface-primary, Canvas));
      }
      #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-master-only] {
        display: none;
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-master-only] {
        display: block;
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-default-summary] {
        display: none;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-current {
        border-color: color-mix(in srgb, #21a66f 22%, currentColor 6%);
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-current[data-empty="true"] {
        border-style: dashed;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 58%, transparent));
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-work-title {
        display: flex;
        align-items: center;
        gap: 7px;
        margin: 0 0 8px;
        font-size: 13px;
        font-weight: 680;
        line-height: 19px;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-priority {
        flex: 0 0 auto;
        padding: 1px 5px;
        border-radius: 999px;
        background: color-mix(in srgb, currentColor 8%, transparent);
        color: var(--color-token-description-foreground, currentColor);
        font-size: 9px;
        line-height: 14px;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-field + .codex-thread-master-field {
        margin-top: 5px;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-field strong {
        margin-right: 5px;
        color: #21a66f;
        font-size: 10px;
        font-weight: 680;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-time-list {
        display: grid;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-time-list li {
        display: grid;
        grid-template-columns: 6px minmax(0, 1fr);
        gap: 8px;
        align-items: start;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-time-list li::before {
        width: 6px;
        height: 6px;
        margin-top: 5px;
        border-radius: 50%;
        background: #d49a2f;
        content: "";
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-time-title {
        display: block;
        font-size: 11px;
        font-weight: 650;
        line-height: 16px;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-time-detail {
        display: block;
        margin-top: 1px;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 58%, transparent));
        font-size: 10px;
        line-height: 15px;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-summary {
        border-top: 0.5px solid color-mix(in srgb, currentColor 8%, transparent);
        color: var(--color-token-description-foreground, currentColor);
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-summary summary {
        padding: 9px 1px 4px;
        cursor: pointer;
        font-size: 10px;
        font-weight: 650;
        list-style-position: inside;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-summary p {
        margin: 5px 1px 0;
        font-size: 10px;
        line-height: 16px;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-label {
        display: block;
        margin-bottom: 5px;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 58%, transparent));
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.04em;
        line-height: 14px;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-card p {
        margin: 0;
        overflow-wrap: anywhere;
        font-size: 11px;
        line-height: 17px;
      }
      #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-overview-meta] {
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 56%, transparent));
        font-size: 9px;
        line-height: 14px;
      }
      #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-add-memo] {
        min-height: 34px;
        margin: 0 13px 13px;
        padding: 0 11px;
        border: 0;
        border-radius: 9px;
        background: #168b5a;
        color: white;
        font-size: 11px;
        font-weight: 650;
        cursor: pointer;
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} {
        border-left-color: color-mix(in srgb, currentColor 8%, transparent);
        background: var(--color-token-main-surface-secondary, Canvas);
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} [data-codex-company-master-view] {
        border-bottom-color: color-mix(in srgb, currentColor 8%, transparent);
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-header,
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-title,
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-summary,
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-overview-meta] {
        display: none;
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-body {
        gap: 16px;
        padding: 16px 14px 12px;
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-card {
        padding: 0 0 14px;
        border: 0;
        border-bottom: 0.5px solid color-mix(in srgb, currentColor 8%, transparent);
        border-radius: 0;
        background: transparent;
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-current > .codex-thread-overview-label {
        font-size: 0;
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-current > .codex-thread-overview-label::after {
        content: "当前任务";
        font-size: 9px;
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-master-current-content] > p:nth-child(2) {
        display: none;
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-work-title {
        margin-bottom: 10px;
        font-size: 13px;
        line-height: 19px;
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-master-field strong {
        color: color-mix(in srgb, #21a66f 76%, currentColor);
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-add-memo] {
        width: fit-content;
        min-height: 28px;
        align-self: flex-start;
        margin: 0 14px 12px;
        padding: 0 9px;
        border: 0.5px solid color-mix(in srgb, currentColor 12%, transparent);
        border-radius: 7px;
        background: transparent;
        color: var(--color-token-description-foreground, currentColor);
        font-size: 10px;
        font-weight: 600;
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-company-ops-launcher {
        display: flex;
        min-height: 62px;
        flex: 0 0 62px;
        align-items: center;
        box-sizing: border-box;
        padding: 8px 10px;
        border-top-color: color-mix(in srgb, currentColor 8%, transparent);
        background: var(--color-token-main-surface-primary, #171717);
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-company-ops-launcher button {
        display: none;
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-company-ops-launcher [data-codex-company-workstream="home"] {
        display: inline-flex;
        width: 100%;
        min-height: 44px;
        align-items: center;
        gap: 9px;
        justify-content: flex-start;
        padding: 5px 9px 5px 6px;
        border-color: color-mix(in srgb, currentColor 11%, transparent);
        border-radius: 8px;
        background: color-mix(in srgb, currentColor 4%, transparent);
        color: inherit;
        text-align: left;
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-company-ops-launcher [data-codex-company-workstream="home"]:hover {
        border-color: color-mix(in srgb, currentColor 18%, transparent);
        background: color-mix(in srgb, currentColor 7%, transparent);
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] #${THREAD_OVERVIEW_RAIL_ID}[data-operations-active="true"] .codex-company-ops-launcher [data-codex-company-workstream="home"] {
        border-color: color-mix(in srgb, #36b982 36%, currentColor 8%);
        background: color-mix(in srgb, #36b982 7%, transparent);
        box-shadow: inset 2px 0 0 #36b982;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-company-ops-entry-mark {
        display: inline-flex;
        width: 30px;
        height: 30px;
        flex: 0 0 30px;
        align-items: center;
        justify-content: center;
        border-radius: 7px;
        background: color-mix(in srgb, #36b982 14%, transparent);
        color: #48c68d;
        font-size: 11px;
        font-weight: 750;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-company-ops-entry-copy {
        display: grid;
        min-width: 0;
        flex: 1 1 auto;
        gap: 1px;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-company-ops-entry-copy strong {
        overflow: hidden;
        font-size: 11px;
        font-weight: 680;
        line-height: 14px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-company-ops-entry-copy small {
        overflow: hidden;
        color: var(--color-token-description-foreground, #929292);
        font-size: 9px;
        font-weight: 500;
        line-height: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-company-ops-entry-chevron {
        flex: 0 0 auto;
        color: var(--color-token-description-foreground, #8a8a8a);
        font-size: 18px;
        font-weight: 400;
        line-height: 1;
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] [data-app-action-timeline-scroll] {
        background: var(--color-token-main-surface-primary, #181818);
        box-shadow: inset -1px 0 0 color-mix(in srgb, currentColor 6%, transparent);
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] [data-user-message-bubble="true"] {
        border-color: color-mix(in srgb, currentColor 9%, transparent);
        background: var(--color-token-main-surface-secondary, #1c1c1c);
      }
      html[${COMPANY_WORKBENCH_MODE_ATTR}="true"] [data-codex-composer-root][data-composer-placement="thread"] [data-composer-surface-variant] {
        background: var(--color-token-main-surface-primary, #181818) !important;
        box-shadow:
          inset 0 0 0 0.5px color-mix(in srgb, currentColor 10%, transparent),
          0 8px 22px color-mix(in srgb, black 16%, transparent) !important;
      }
      @media (max-width: 1100px) {
        #${THREAD_OVERVIEW_RAIL_ID} { display: none; }
      }
      #${USAGE_ID} {
        display: grid !important;
        position: relative;
        flex: 0 0 112px !important;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        box-sizing: border-box !important;
        width: 112px !important;
        min-width: 112px !important;
        max-width: 112px !important;
        height: 28px !important;
        min-height: 28px !important;
        margin: 0 !important;
        padding: 3px 8px 6px;
        overflow: hidden;
        border: 0.5px solid color-mix(in srgb, currentColor 10%, transparent);
        border-radius: 9px;
        background: color-mix(in srgb, var(--color-token-main-surface-secondary, Canvas) 74%, transparent);
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 68%, transparent));
        box-shadow: inset 0 1px 0 color-mix(in srgb, white 22%, transparent);
        font-variant-numeric: tabular-nums;
      }
      #${USAGE_ID}[data-tone="muted"] {
        opacity: 0.68;
      }
      #${USAGE_ID} .${USAGE_TEXT_CLASS} {
        min-width: 0;
        overflow: hidden;
        font-size: 10px;
        font-weight: 500;
        line-height: 16px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${USAGE_ID} .${USAGE_VALUE_CLASS} {
        margin-left: 4px;
        color: var(--color-token-text-primary, currentColor);
        font-size: 12px;
        font-weight: 650;
        line-height: 16px;
        white-space: nowrap;
      }
      #${USAGE_ID} .codex-conversation-usage-track {
        position: absolute;
        right: 8px;
        bottom: 3px;
        left: 8px;
        height: 2px;
        overflow: hidden;
        border-radius: 999px;
        background: color-mix(in srgb, currentColor 9%, transparent);
      }
      #${USAGE_ID} .${USAGE_FILL_CLASS} {
        display: block;
        width: 100%;
        height: 100%;
        border-radius: inherit;
        background: var(--color-token-accent-foreground, currentColor);
        opacity: 0.56;
        transform: scaleX(0);
        transform-origin: left center;
        transition: transform 180ms ease;
      }
      #${USAGE_ID}[data-tone="warning"] .${USAGE_FILL_CLASS} {
        background: #b7791f;
        opacity: 0.78;
      }
      #${USAGE_ID}[data-tone="critical"] .${USAGE_FILL_CLASS} {
        background: #c2413b;
        opacity: 0.82;
      }
      #${TOGGLE_ID} {
        display: inline-flex !important;
        position: relative;
        flex: 0 0 26px !important;
        align-items: center !important;
        justify-content: center !important;
        box-sizing: border-box !important;
        width: 26px !important;
        min-width: 26px !important;
        max-width: 26px !important;
        height: 26px !important;
        min-height: 26px !important;
        margin: 0 !important;
        padding: 4px !important;
        overflow: visible !important;
        border: 0 !important;
        border-radius: 10px !important;
        background: transparent !important;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 66%, transparent));
        box-shadow: none;
        cursor: pointer;
        transition: none;
      }
      #${TOGGLE_ID}:hover {
        background: var(--color-token-list-hover-background, color-mix(in srgb, currentColor 7%, transparent)) !important;
        color: var(--color-token-text-primary, currentColor);
      }
      #${TOGGLE_ID}[aria-checked="true"] {
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 66%, transparent));
      }
      #${TOGGLE_ID}:focus-visible {
        outline: none !important;
        /* Match the native search control: keyboard focus does not leave a
           selected-looking fill behind the view glyph. */
        background: transparent !important;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 66%, transparent));
      }
      #${TOGGLE_ID}:active {
        /* Avoid a pressed/selected state that persists after switching. */
        background: transparent !important;
      }
      #${TOGGLE_ID} .${SWITCH_THUMB_CLASS} {
        display: inline-flex;
        width: 16px;
        height: 16px;
        align-items: center;
        justify-content: center;
        flex: 0 0 16px;
        border-radius: 4px;
        color: currentColor;
        opacity: 1;
      }
      #${TOGGLE_ID} .${SWITCH_THUMB_CLASS} svg {
        display: block;
        width: 16px;
        height: 16px;
      }
      [data-codex-home-suggestions-hidden="true"] {
        display: none !important;
      }
      #${HOME_PROJECT_SHELF_ID} {
        display: flex;
        width: 100%;
        min-width: 0;
        flex-direction: column;
        gap: 8px;
        box-sizing: border-box;
        color: var(--color-token-text-primary, var(--color-token-foreground, currentColor));
      }
      #${HOME_PROJECT_SHELF_ID} .codex-home-project-header {
        display: flex;
        min-width: 0;
        height: 24px;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      #${HOME_PROJECT_SHELF_ID} .codex-home-project-heading {
        display: inline-flex;
        min-width: 0;
        align-items: center;
        gap: 7px;
        margin: 0;
        font-size: 13px;
        font-weight: 650;
        line-height: 20px;
      }
      #${HOME_PROJECT_SHELF_ID} .codex-home-project-heading::before {
        width: 7px;
        height: 7px;
        flex: 0 0 7px;
        border-radius: 50%;
        background: var(--vscode-textLink-foreground, #2f95ff);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--vscode-textLink-foreground, #2f95ff) 10%, transparent);
        content: "";
      }
      #${HOME_PROJECT_SHELF_ID} .codex-home-project-count {
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 56%, transparent));
        font-size: 11px;
        line-height: 18px;
        white-space: nowrap;
      }
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-grid] {
        display: grid;
        min-width: 0;
        max-height: 174px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        align-items: stretch;
        gap: 8px;
        overflow-x: hidden;
        overflow-y: auto;
        padding: 1px;
        scrollbar-gutter: stable;
      }
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-card] {
        position: relative;
        min-width: 0;
        height: 82px;
        overflow: hidden;
        border: 0.5px solid color-mix(in srgb, currentColor 11%, transparent);
        border-radius: 13px;
        background: color-mix(in srgb, var(--color-token-main-surface-secondary, Canvas) 72%, transparent);
        box-shadow: inset 0 1px 0 color-mix(in srgb, white 22%, transparent), 0 4px 13px color-mix(in srgb, black 5%, transparent);
        backdrop-filter: blur(14px) saturate(112%);
        -webkit-backdrop-filter: blur(14px) saturate(112%);
      }
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-open] {
        display: grid;
        width: 100%;
        height: 100%;
        min-width: 0;
        grid-template-columns: 34px minmax(0, 1fr);
        grid-template-rows: 20px 18px 18px;
        align-content: center;
        column-gap: 9px;
        box-sizing: border-box;
        padding: 9px 34px 9px 10px;
        overflow: hidden;
        border: 0;
        border-radius: inherit;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        transition: background-color 150ms ease, transform 150ms ease;
      }
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-open]:hover {
        background: color-mix(in srgb, var(--color-token-list-hover-background, Canvas) 82%, transparent);
      }
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-open]:active {
        transform: scale(0.995);
      }
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-open]:focus-visible,
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-pin]:focus-visible {
        outline: 2px solid var(--color-token-accent-foreground, Highlight);
        outline-offset: -3px;
      }
      #${HOME_PROJECT_SHELF_ID} .codex-home-project-avatar {
        display: inline-flex;
        grid-row: 1 / 4;
        width: 34px;
        height: 34px;
        align-self: center;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 10px;
        background: color-mix(in srgb, currentColor 88%, Canvas);
        color: var(--color-token-main-surface-primary, Canvas);
        font-size: 13px;
        font-weight: 680;
        line-height: 1;
      }
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-name],
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-task] {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-name] {
        padding-right: 4px;
        font-size: 13px;
        font-weight: 640;
        line-height: 20px;
      }
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-task] {
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 63%, transparent));
        font-size: 11px;
        line-height: 18px;
      }
      #${HOME_PROJECT_SHELF_ID} .codex-home-project-meta {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 6px;
        overflow: hidden;
        font-size: 10px;
        line-height: 18px;
      }
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-status] {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 4px;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 62%, transparent));
        white-space: nowrap;
      }
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-status]::before {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: currentColor;
        content: "";
      }
      #${HOME_PROJECT_SHELF_ID} [data-phase="active"] [data-codex-home-project-status] {
        color: var(--vscode-textLink-foreground, #2f95ff);
      }
      #${HOME_PROJECT_SHELF_ID} [data-phase="completed"] [data-codex-home-project-status] {
        color: #b7791f;
      }
      #${HOME_PROJECT_SHELF_ID} [data-phase="pinned"] [data-codex-home-project-status] {
        color: #7c5ce0;
      }
      #${HOME_PROJECT_SHELF_ID} .codex-home-project-active-count {
        min-width: 0;
        overflow: hidden;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 52%, transparent));
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-pin] {
        display: inline-flex;
        position: absolute;
        z-index: 2;
        top: 7px;
        right: 7px;
        width: 25px;
        height: 25px;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 55%, transparent));
        cursor: pointer;
        transition: color 150ms ease, background-color 150ms ease, transform 150ms ease;
      }
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-pin]:hover {
        background: color-mix(in srgb, currentColor 7%, transparent);
        color: var(--color-token-text-primary, currentColor);
      }
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-pin][aria-pressed="true"] {
        background: color-mix(in srgb, #7c5ce0 13%, transparent);
        color: #7c5ce0;
      }
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-pin]:active {
        transform: scale(0.94);
      }
      #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-pin] svg {
        width: 15px;
        height: 15px;
      }
      #${HOME_PROJECT_SHELF_ID}[data-available="false"] {
        width: fit-content;
        max-width: 100%;
        padding: 7px 10px;
        border: 0.5px solid color-mix(in srgb, currentColor 10%, transparent);
        border-radius: 10px;
        background: color-mix(in srgb, var(--color-token-main-surface-secondary, Canvas) 62%, transparent);
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 58%, transparent));
        font-size: 11px;
        line-height: 18px;
      }
      [${SKILL_NATIVE_SECTION_ATTR}="hidden"],
      [${SKILL_NATIVE_SEARCH_ATTR}="hidden"],
      [${SKILL_NATIVE_EXTRA_ATTR}="hidden"] {
        display: none !important;
      }
      #${SKILL_ORGANIZER_ID} {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 12px;
        color: var(--color-token-foreground, currentColor);
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-organizer-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 0 8px;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-organizer-title-wrap {
        min-width: 0;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-organizer-kicker {
        display: none;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-organizer-title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        line-height: 24px;
        letter-spacing: -0.01em;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-organizer-subtitle {
        margin: 1px 0 0;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 58%, transparent));
        font-size: 13px;
        line-height: 20px;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-native-toggle {
        flex: none;
        min-height: 34px;
        padding: 0 12px;
        border: 0.5px solid var(--color-token-border, color-mix(in srgb, currentColor 18%, transparent));
        border-radius: 8px;
        background: transparent;
        color: var(--color-token-description-foreground, currentColor);
        font-size: 12px;
        cursor: pointer;
        transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-native-toggle:hover {
        border-color: color-mix(in srgb, currentColor 28%, transparent);
        background: color-mix(in srgb, currentColor 6%, transparent);
        color: var(--color-token-foreground, currentColor);
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-organizer-tools {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 8px;
        padding: 0 8px;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-search {
        display: flex;
        width: 100%;
        height: 40px;
        align-items: center;
        gap: 8px;
        padding: 0 11px;
        border: 0.5px solid var(--color-token-input-border, color-mix(in srgb, currentColor 18%, transparent));
        border-radius: 9px;
        background: var(--color-token-input-background, color-mix(in srgb, currentColor 4%, transparent));
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-search:focus-within {
        border-color: color-mix(in srgb, #2f80ed 58%, transparent);
        box-shadow: 0 0 0 2px color-mix(in srgb, #2f80ed 13%, transparent);
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-search svg {
        width: 16px;
        height: 16px;
        flex: none;
        opacity: 0.58;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-search input {
        min-width: 0;
        flex: 1;
        border: 0;
        outline: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 13px;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-search-clear {
        display: none;
        width: 24px;
        height: 24px;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 0;
        border-radius: 7px;
        background: transparent;
        color: inherit;
        cursor: pointer;
        opacity: 0.62;
      }
      #${SKILL_ORGANIZER_ID}[data-has-query="true"] .codex-skill-search-clear {
        display: inline-flex;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-filter-list {
        display: flex;
        min-width: 0;
        flex-wrap: wrap;
        gap: 4px;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-filter {
        min-height: 32px;
        padding: 0 11px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 62%, transparent));
        font-size: 12px;
        cursor: pointer;
        transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-filter:hover {
        background: color-mix(in srgb, currentColor 5%, transparent);
        color: var(--color-token-foreground, currentColor);
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-filter[aria-selected="true"] {
        background: color-mix(in srgb, currentColor 9%, transparent);
        color: var(--color-token-foreground, currentColor);
        font-weight: 600;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-result-head {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        min-height: 22px;
        padding: 0 8px 2px;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-result-title {
        display: none;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-result-count {
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 58%, transparent));
        font-size: 12px;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-grid {
        display: flex;
        flex-direction: column;
        gap: 0;
        padding: 0 8px;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-group {
        min-width: 0;
        border-bottom: 0.5px solid var(--color-token-border-light, color-mix(in srgb, currentColor 10%, transparent));
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-group-toggle {
        display: grid;
        width: 100%;
        min-width: 0;
        min-height: 62px;
        grid-template-columns: minmax(0, 1fr) auto 24px;
        align-items: center;
        gap: 12px;
        padding: 8px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
        outline: none;
        transition: background-color 150ms ease;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-group-toggle:hover,
      #${SKILL_ORGANIZER_ID} .codex-skill-group-toggle:focus-visible,
      #${SKILL_ORGANIZER_ID} .codex-skill-group-toggle[aria-expanded="true"] {
        background: color-mix(in srgb, currentColor 5%, transparent);
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-group-copy {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 1px;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-group-title {
        overflow: hidden;
        color: var(--color-token-foreground, currentColor);
        font-size: 13px;
        font-weight: 600;
        line-height: 20px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-group-description {
        overflow: hidden;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 58%, transparent));
        font-size: 12px;
        line-height: 18px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-group-count {
        min-width: 25px;
        padding: 2px 8px;
        border-radius: 999px;
        background: color-mix(in srgb, currentColor 6%, transparent);
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 60%, transparent));
        font-size: 11px;
        line-height: 18px;
        text-align: center;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-group-chevron {
        display: inline-flex;
        width: 24px;
        height: 24px;
        align-items: center;
        justify-content: center;
        color: var(--color-token-description-foreground, currentColor);
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-group-chevron svg {
        width: 15px;
        height: 15px;
        transition: transform 150ms ease;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-group-toggle[aria-expanded="true"] .codex-skill-group-chevron svg {
        transform: rotate(90deg);
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-group-items {
        margin: 0 0 4px 20px;
        padding-left: 10px;
        border-left: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-group-items[hidden] {
        display: none;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-row {
        display: grid;
        min-width: 0;
        min-height: 58px;
        grid-template-columns: 34px minmax(0, 1fr) 36px;
        align-items: center;
        gap: 12px;
        padding: 6px 8px;
        border-bottom: 0.5px solid var(--color-token-border-light, color-mix(in srgb, currentColor 10%, transparent));
        border-radius: 7px;
        cursor: pointer;
        outline: none;
        transition: background-color 150ms ease;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-row:hover,
      #${SKILL_ORGANIZER_ID} .codex-skill-row:focus-visible {
        background: color-mix(in srgb, currentColor 6%, transparent);
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-icon {
        display: inline-flex;
        width: 32px;
        height: 32px;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 8px;
        background: var(--color-token-bg-primary, color-mix(in srgb, currentColor 6%, transparent));
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-icon svg,
      #${SKILL_ORGANIZER_ID} .codex-skill-icon img {
        width: 19px;
        height: 19px;
        object-fit: contain;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-copy {
        display: grid;
        min-width: 0;
        grid-template-columns: minmax(190px, 0.42fr) minmax(0, 1fr);
        align-items: center;
        gap: 20px;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-name {
        display: block;
        overflow: hidden;
        color: var(--color-token-foreground, currentColor);
        font-size: 13px;
        font-weight: 600;
        line-height: 19px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-description {
        display: block;
        overflow: hidden;
        margin: 0;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 58%, transparent));
        font-size: 12px;
        line-height: 18px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-favorite {
        display: inline-flex;
        width: 32px;
        height: 32px;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--color-token-description-foreground, currentColor);
        cursor: pointer;
        opacity: 0.34;
        transition: background-color 150ms ease, color 150ms ease, opacity 150ms ease, transform 150ms ease;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-favorite:hover {
        background: color-mix(in srgb, currentColor 7%, transparent);
        opacity: 0.82;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-favorite[aria-pressed="true"] {
        color: #d89a27;
        opacity: 0.9;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-favorite svg {
        width: 17px;
        height: 17px;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-favorite:active {
        transform: scale(0.92);
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-empty {
        grid-column: 1 / -1;
        padding: 44px 16px;
        text-align: center;
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 58%, transparent));
        font-size: 13px;
      }
      #${SKILL_ORGANIZER_ID} .codex-skill-empty button {
        display: block;
        margin: 10px auto 0;
        padding: 7px 11px;
        border: 0.5px solid var(--color-token-border, color-mix(in srgb, currentColor 18%, transparent));
        border-radius: 8px;
        background: transparent;
        color: var(--color-token-foreground, currentColor);
        cursor: pointer;
      }
      @media (max-width: 1050px) {
        #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-grid] {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        #${SKILL_ORGANIZER_ID} .codex-skill-copy {
          display: block;
        }
        #${SKILL_ORGANIZER_ID} .codex-skill-description {
          margin-top: 1px;
        }
        #${SKILL_ORGANIZER_ID} .codex-skill-group-description {
          display: none;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        #${ASSET_CONSOLE_PANEL_ID} .codex-asset-console-spinner {
          animation: none !important;
        }
        #${TOGGLE_ID},
        #${TOGGLE_ID} .${SWITCH_THUMB_CLASS},
        #${USAGE_ID} .${USAGE_FILL_CLASS},
        #${SHORTCUT_GRID_ID} .${SHORTCUT_CARD_CLASS},
        #${SECTION_TABS_ID} [role="tab"],
        #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-tag],
        #${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-expand] svg,
        #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-open],
        #${HOME_PROJECT_SHELF_ID} [data-codex-home-project-pin],
        #${SKILL_ORGANIZER_ID} button,
        #${SKILL_ORGANIZER_ID} .codex-skill-row {
          transition-duration: 0.01ms !important;
        }
      }
      [role="tooltip"][data-codex-conversation-preview-tooltip="true"] {
        width: min(30rem, calc(100vw - 16px)) !important;
        max-width: min(30rem, calc(100vw - 16px)) !important;
      }
      [role="tooltip"][data-codex-conversation-preview-tooltip="true"] [class*="max-w-"] {
        max-width: none !important;
        width: 100% !important;
      }
      .${DETAILS_CLASS} {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 7px;
        margin-top: 4px;
        padding-top: 8px;
        border-top: 0.5px solid var(--color-token-border, color-mix(in srgb, currentColor 16%, transparent));
      }
      .${DETAILS_CLASS} .codex-conversation-preview-block {
        display: grid;
        min-width: 0;
        grid-template-columns: 52px minmax(0, 1fr);
        align-items: start;
        gap: 8px;
      }
      .${DETAILS_CLASS} .codex-conversation-preview-label {
        color: var(--color-token-description-foreground, color-mix(in srgb, currentColor 62%, transparent));
        font-size: 12px;
        line-height: 18px;
      }
      .${DETAILS_CLASS} .codex-conversation-preview-text {
        display: -webkit-box;
        min-width: 0;
        overflow: hidden;
        color: var(--color-token-foreground, inherit);
        font-size: 13px;
        line-height: 18px;
        white-space: normal;
        overflow-wrap: anywhere;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="list"] .app-shell-left-panel > :has(> #app-shell-sidebar) {
        min-width: 0 !important;
        width: 100% !important;
      }
      html[data-codex-task-shell="true"] #${SIDEBAR_CONTROLS_ID} {
        gap: 8px;
        margin-bottom: 8px;
      }
      html[data-codex-task-shell="true"] #${SHORTCUT_GRID_ID}[data-codex-shortcut-compact="true"] {
        position: relative;
        align-items: center;
        gap: 4px;
        padding-bottom: 0;
      }
      html[data-codex-task-shell="true"] #${SHORTCUT_GRID_ID}[data-codex-shortcut-compact="true"]:has(> [data-codex-shortcut-more]) {
        grid-template-columns: repeat(var(--codex-sidebar-shortcut-columns, 2), minmax(0, 1fr)) 30px;
      }
      html[data-codex-task-shell="true"] #${SHORTCUT_GRID_ID}[data-codex-shortcut-compact="true"] > [data-codex-sidebar-shortcut-card-wrap] {
        display: flex;
        align-items: center;
      }
      html[data-codex-task-shell="true"] #${SHORTCUT_GRID_ID}[data-codex-shortcut-compact="true"] .${SHORTCUT_CARD_CLASS} {
        height: 32px;
        padding: 5px 6px;
        gap: 6px;
        flex-direction: row;
        justify-content: flex-start;
        border-color: transparent;
        border-radius: 6px;
        box-shadow: none;
        background: transparent;
        transform: none;
        transition: background-color 150ms ease;
      }
      html[data-codex-task-shell="true"] #${SHORTCUT_GRID_ID}[data-codex-shortcut-compact="true"] .${SHORTCUT_CARD_CLASS}:hover,
      html[data-codex-task-shell="true"] #${SHORTCUT_GRID_ID}[data-codex-shortcut-compact="true"] .${SHORTCUT_CARD_CLASS}[data-active="true"] {
        background: var(--color-token-list-hover-background, rgba(255,255,255,.12));
      }
      html[data-codex-task-shell="true"] #${SHORTCUT_GRID_ID}[data-codex-shortcut-compact="true"] .${SHORTCUT_ICON_CLASS} {
        width: 18px;
        height: 18px;
        flex-basis: 18px;
        background: transparent;
      }
      html[data-codex-task-shell="true"] #${SHORTCUT_GRID_ID}[data-codex-shortcut-compact="true"] .${SHORTCUT_LABEL_CLASS} {
        font-size: 11px;
        line-height: 16px;
        text-align: left;
      }
      html[data-codex-task-shell="true"] #${SHORTCUT_GRID_ID}[data-codex-shortcut-compact="true"] [data-codex-sidebar-shortcut-quick="true"] {
        position: static;
        flex: 0 0 20px;
        height: 28px;
        border: 0;
        background: transparent;
        box-shadow: none;
      }
      html[data-codex-task-shell="true"] #${SHORTCUT_GRID_ID}[data-codex-shortcut-compact="true"] .codex-sidebar-shortcut-status {
        top: 3px;
        right: 2px;
        width: 4px;
        height: 4px;
      }
      html[data-codex-task-shell="true"] .${SUMMARY_CLASS},
      html[data-codex-task-shell="true"] .${CARD_SUMMARY_CLASS},
      html[data-codex-task-shell="true"] .${TIME_CLASS} {
        color: color-mix(in srgb, currentColor 78%, transparent);
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="list"] [data-codex-conversation-preview-enhanced="true"] {
        height: var(--height-token-row, 40px) !important;
        min-height: var(--height-token-row, 40px) !important;
        padding: var(--padding-row-y, 6px) var(--padding-row-cell-x, var(--padding-row-x, 8px)) !important;
        border-radius: var(--radius-token-row, 8px) !important;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="list"] [data-codex-conversation-preview-title="true"] {
        gap: 2px !important;
        min-width: 0;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="list"] [data-codex-conversation-preview-title="true"] [data-thread-title="true"] {
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="list"] .${SUMMARY_CLASS} {
        display: none !important;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="list"] [data-codex-conversation-preview-title="true"] .${SUMMARY_CLASS} {
        display: none !important;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="list"] [data-codex-conversation-preview-title="true"] {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        min-height: 0 !important;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="list"] [data-codex-conversation-preview-title="true"] > [data-thread-title="true"] {
        flex: 1 1 auto !important;
        width: auto !important;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="list"] .${SUMMARY_CLASS} {
        font-size: 12px;
        font-weight: 400;
        line-height: 16px;
        color: color-mix(in srgb, currentColor 65%, transparent);
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="list"] [data-codex-conversation-preview-enhanced="true"] > div:has(> div > [data-thread-title-trigger="true"]) > div:empty {
        display: none !important;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"] {
        height: 136px !important;
        min-height: 136px !important;
        max-height: 136px !important;
        border: 1px solid var(--task-card-border, #3e4349) !important;
        border-radius: 10px !important;
        background: linear-gradient(145deg, var(--task-card-surface, #24272a), color-mix(in srgb, var(--task-card-surface, #24272a) 82%, #101214)) !important;
        color: #eef2f6;
        box-shadow: none;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        scroll-margin-block: 12px;
        transition: background-color 160ms ease-out, border-color 160ms ease-out, transform 160ms ease-out;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] .app-shell-left-panel:has([data-app-action-sidebar-scroll]) > .max-w-full,
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] .app-shell-left-panel:has([data-app-action-sidebar-scroll]) > .max-w-full > *,
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] .app-shell-left-panel:has([data-app-action-sidebar-scroll]) [data-app-action-sidebar-scroll] {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] .app-shell-left-panel > :has(> #app-shell-sidebar) {
        min-width: 0 !important;
        width: 100% !important;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] #app-shell-sidebar {
        container-type: inline-size;
        container-name: task-sidebar;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-app-action-sidebar-scroll] {
        mask-image: none !important;
      }
      /* Keep project groups out of the browser's expensive transition-all
         path. Codex owns the open/closed height; task cards remain compositor
         friendly and do not animate layout during a toggle. */
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-sidebar-project-kind],
      html[data-codex-conversation-view="card"] [data-sidebar-project-kind] {
        contain: layout paint;
        transition: none !important;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-sidebar-project-kind] > [data-app-action-sidebar-project-row],
      html[data-codex-conversation-view="card"] [data-sidebar-project-kind] > [data-app-action-sidebar-project-row] {
        transition: background-color 120ms ease, color 120ms ease !important;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-card-grid="true"] {
        gap: 10px !important;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"]:hover {
        border-color: #65707b !important;
        background: #2b2f34 !important;
        box-shadow: none;
        transform: none;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"]:is([aria-current="page"], [data-app-action-sidebar-thread-selected="true"]) {
        border-color: #779ec6 !important;
        background: #263b50 !important;
        box-shadow: none;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"]:focus-visible {
        outline: 2px solid #a9cfff;
        outline-offset: -3px;
      }
      /* Grid cards must follow the host theme. The original card block used a
         dark fallback palette unconditionally, which produced black cards in
         Codex light mode. */
      html.electron-light[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"] {
        border-color: color-mix(in srgb, #1f2937 16%, transparent) !important;
        background: var(--color-token-main-surface-secondary, #ffffff) !important;
        color: var(--color-token-foreground, #202123) !important;
      }
      html.electron-light[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"]:hover {
        border-color: color-mix(in srgb, #1f2937 28%, transparent) !important;
        background: var(--color-token-list-hover-background, #f3f4f6) !important;
        color: var(--color-token-foreground, #202123) !important;
      }
      html.electron-light[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"]:is([aria-current="page"], [data-app-action-sidebar-thread-selected="true"]) {
        border-color: color-mix(in srgb, #2f80ed 46%, transparent) !important;
        background: color-mix(in srgb, #2f80ed 12%, var(--color-token-main-surface-secondary, #ffffff)) !important;
        color: var(--color-token-foreground, #202123) !important;
      }
      html.electron-light[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"] .${CARD_SUMMARY_CLASS},
      html.electron-light[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"] .${TIME_CLASS},
      html.electron-light[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"] .${TAGS_CLASS} {
        color: color-mix(in srgb, var(--color-token-foreground, #202123) 64%, transparent) !important;
      }
      html.electron-light[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"] .${CARD_TITLE_CLASS} {
        color: var(--color-token-foreground, #202123) !important;
      }
      html.electron-light[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"] .${CARD_TITLE_CLASS}[data-codex-card-main]::before {
        color: var(--color-token-foreground, #202123) !important;
      }
      html.electron-light[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"] .${CARD_TITLE_CLASS}[data-codex-card-main]::after {
        color: color-mix(in srgb, var(--color-token-foreground, #202123) 64%, transparent) !important;
      }
      html.electron-light[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"]::after {
        color: color-mix(in srgb, #2f80ed 74%, #202123) !important;
      }
      /* In list mode the native sidebar owns row geometry. Reset both the
         enhanced row and its list-item wrapper so card sizing cannot leak. */
      html[data-codex-conversation-view="list"] [data-codex-conversation-card-grid="true"] {
        display: block !important;
        gap: 0 !important;
      }
      html[data-codex-conversation-view="list"] [data-codex-conversation-card-item="true"] {
        display: block !important;
        height: auto !important;
        min-height: 0 !important;
      }
      html[data-codex-conversation-view="list"] [data-codex-conversation-preview-enhanced="true"] {
        display: flex !important;
        align-items: center !important;
        height: var(--height-token-row, 40px) !important;
        min-height: var(--height-token-row, 40px) !important;
        max-height: none !important;
        padding: var(--padding-row-y, 6px) var(--padding-row-cell-x, var(--padding-row-x, 8px)) !important;
      }
      html[data-codex-conversation-view="list"] [data-codex-conversation-preview-title="true"] {
        display: flex !important;
        flex: 1 1 auto !important;
        flex-direction: row !important;
        align-items: center !important;
        min-height: 0 !important;
        gap: 0 !important;
        box-sizing: border-box !important;
        min-width: 0 !important;
        padding-inline-end: 56px !important;
        overflow: hidden !important;
      }
      html[data-codex-conversation-view="list"] [data-codex-conversation-preview-title="true"] > [data-thread-title="true"] {
        display: block !important;
        min-width: 0 !important;
        max-width: 100% !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
      /* Keep the native action cluster at the row's right edge and vertically
         centered. It must not be positioned relative to the hidden summary. */
      html[data-codex-conversation-view="list"] [data-codex-conversation-preview-enhanced="true"] > [data-hover-card-open-immediately]:not(.contents),
      html[data-codex-conversation-view="list"] [data-codex-conversation-preview-enhanced="true"] > [data-hover-card-open-immediately].contents > div {
        position: absolute !important;
        inset: 0 2px 0 auto !important;
        width: auto !important;
        min-width: 0 !important;
        height: 100% !important;
        padding: 0 2px !important;
        margin: 0 !important;
        gap: 4px !important;
        align-items: center !important;
        justify-content: flex-end !important;
      }
      html[data-codex-conversation-view="list"] [data-codex-conversation-preview-enhanced="true"] > [data-hover-card-open-immediately] button {
        flex: 0 0 auto;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] .${CARD_CONTENT_CLASS} {
        grid-template-rows: auto 1fr 16px;
        gap: 4px;
        padding: 12px;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] .${CARD_TITLE_CLASS} {
        grid-row: 1;
        align-self: start;
        padding-right: 0;
        max-height: 42px;
        color: #eef2f6;
        line-height: 21px;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] .${CARD_TITLE_CLASS}[data-codex-card-main] {
        display: block;
        font-size: 0;
        line-height: 0;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] .${CARD_TITLE_CLASS}[data-codex-card-main]::before,
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] .${CARD_TITLE_CLASS}[data-codex-card-main]::after {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 21px;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] .${CARD_TITLE_CLASS}[data-codex-card-main]::before {
        content: attr(data-codex-card-main);
        font-size: 14px;
        font-weight: 600;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] .${CARD_TITLE_CLASS}[data-codex-card-main]::after {
        content: attr(data-codex-card-qualifier);
        color: #c9d3de;
        font-size: 12px;
        font-weight: 500;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] .${CARD_SUMMARY_CLASS} {
        grid-row: 2;
        color: #b6c0ca;
        font-size: 12px;
        font-weight: 400;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] .${TIME_CLASS} {
        grid-row: 3;
        justify-self: end;
        max-width: calc(100% - 90px);
        color: #a6b2be;
        font-variant-numeric: tabular-nums;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] .${TAGS_CLASS} {
        display: none;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"] > [data-hover-card-open-immediately]:not(.contents),
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"] > [data-hover-card-open-immediately].contents > div {
        position: absolute !important;
        inset: auto auto 10px 12px !important;
        width: 48px !important;
        height: 20px !important;
        padding: 0 !important;
        margin: 0 !important;
        justify-content: flex-start !important;
        align-items: center !important;
        z-index: 2;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"]:is([aria-current="page"], [data-app-action-sidebar-thread-selected="true"]):not(:hover):not(:focus-within)::after {
        content: "✓ 当前任务";
        position: absolute;
        left: 12px;
        bottom: 12px;
        color: #a9cfff;
        font-size: 11px;
        line-height: 16px;
        pointer-events: none;
      }
      html[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"]:is([aria-current="page"], [data-app-action-sidebar-thread-selected="true"]):has(> [data-hover-card-open-immediately]:not(.contents))::after {
        left: 40px !important;
        content: "当前" !important;
      }
      @container task-sidebar (max-width: 419px) {
        html[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-card-grid="true"] {
          grid-template-columns: minmax(0, 1fr) !important;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        html[data-codex-task-shell="true"][data-codex-conversation-view="card"] [data-codex-conversation-preview-enhanced="true"] {
          transition: none;
        }
      }
      html[data-codex-task-shell="true"] .${TAGS_CLASS} {
        display: flex;
      }
      html.electron-dark[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID} {
        background: #1c1e20;
      }
      html.electron-dark[data-codex-task-shell="true"] #app-shell-sidebar {
        --color-token-sidebar-surface-primary: #1c1e20;
      }
      /* Keep the sidebar on the same transparent surface as the application
         top bar in both themes. */
      #${SIDEBAR_CONTROLS_ID},
      #${SHORTCUT_GRID_ID} {
        background: transparent;
      }
      html.electron-light .app-shell-left-panel:has(#app-shell-sidebar),
      html.electron-light .app-shell-left-panel:has([data-app-action-sidebar-scroll]),
      html.electron-light #app-shell-sidebar,
      html.electron-light [data-app-action-sidebar-scroll] {
        background: transparent;
      }
      html.electron-dark .app-shell-left-panel:has(#app-shell-sidebar),
      html.electron-dark .app-shell-left-panel:has([data-app-action-sidebar-scroll]),
      html.electron-dark #app-shell-sidebar,
      html.electron-dark [data-app-action-sidebar-scroll] {
        background: transparent;
      }
      /* The current renderer keeps a 461px min-width on the wrapper inside
         the aside. Release that stale resize width so the scroll region and
         every native row follow the constrained panel instead of overflowing. */
      html[data-codex-conversation-view="list"] .app-shell-left-panel:has([data-app-action-sidebar-scroll]) > .max-w-full,
      html[data-codex-conversation-view="list"] .app-shell-left-panel:has([data-app-action-sidebar-scroll]) > .max-w-full > * {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }
      html[data-codex-conversation-view="list"] .app-shell-left-panel:has([data-app-action-sidebar-scroll]) [data-app-action-sidebar-scroll] {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }
      /* Embedded workspaces inherit Codex light/dark surfaces instead of
         shipping a second, unrelated color system. */
      #${THREAD_OVERVIEW_RAIL_ID} {
        --codex-workspace-bg: var(--color-token-sidebar-surface-primary, var(--color-token-main-surface-primary, #f7f7f8));
        --codex-workspace-panel: var(--color-token-main-surface-secondary, #ffffff);
        --codex-workspace-border: color-mix(in srgb, currentColor 12%, transparent);
        --codex-workspace-muted: color-mix(in srgb, currentColor 62%, transparent);
        background: var(--codex-workspace-bg) !important;
        color: var(--color-token-text-primary, var(--color-token-foreground, #202123));
      }
      html.electron-dark #${THREAD_OVERVIEW_RAIL_ID} {
        --codex-workspace-bg: #1c1e20;
        --codex-workspace-panel: #24272a;
        --codex-workspace-border: #ffffff18;
        --codex-workspace-muted: #aab3bb;
        color: #edf1f4;
      }
      #${THREAD_OVERVIEW_RAIL_ID} .codex-asset-console-body,
      #${THREAD_OVERVIEW_RAIL_ID} [data-task-asset-console-host] {
        background: var(--codex-workspace-bg) !important;
      }
      #${THREAD_OVERVIEW_RAIL_ID} #${ASSET_CONSOLE_PANEL_ID} {
        border-left: 1px solid var(--codex-workspace-border);
        background: var(--codex-workspace-bg);
      }
      html[data-codex-task-shell="true"] [data-app-action-timeline-scroll]:has(> [data-thread-scroll-footer="true"]) {
        height: calc(100% - var(--thread-scroll-padding-bottom, 0px) + var(--spacing)) !important;
        scroll-padding-bottom: 16px !important;
      }
      html[data-codex-task-shell="true"] [data-app-action-timeline-scroll]:has(> [data-thread-scroll-footer="true"])
      > :has(> [data-thread-user-message-navigation-content]) > .sticky.bottom-0 {
        display: none;
      }
      html[data-codex-task-shell="true"] [data-thread-find-target="conversation"]
      > .relative.shrink-0:has(> .flex.flex-col[style*="margin-top"]) {
        min-height: max-content;
      }
      html[data-codex-task-shell="true"] [data-thread-find-target="conversation"]
      [data-local-conversation-user-anchor="true"] [role="button"][aria-haspopup="dialog"]:has(> img[alt="用户附件"]) {
        width: fit-content !important;
        height: auto !important;
        max-width: min(360px, 100%);
        min-width: 0;
        border-radius: 10px;
      }
      html[data-codex-task-shell="true"] [data-thread-find-target="conversation"]
      [data-local-conversation-user-anchor="true"] [role="button"][aria-haspopup="dialog"] > img[alt="用户附件"] {
        width: auto !important;
        height: auto !important;
        max-width: 100%;
        max-height: 260px;
        object-fit: contain;
      }
      html[data-codex-task-shell="true"] [data-thread-find-target="conversation"]
      button[data-markdown-image-preview-trigger="true"]:not(.overflow-auto) > img {
        max-width: min(480px, 100%);
        max-height: 320px;
        object-fit: contain;
      }
      html[data-codex-task-shell="true"] .${TAGS_CLASS} > span {
        border: 0;
        border-radius: 4px;
        max-width: 50%;
      }
      #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-overview-expand],
      #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-overview-collapse] {
        display: none;
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font: inherit;
      }
      html[data-codex-task-shell="true"]:not([data-codex-company-workbench="true"]) #${THREAD_OVERVIEW_RAIL_ID} {
        position: fixed;
        z-index: 30;
        top: 40px;
        right: 0;
        bottom: 0;
        width: 320px;
        flex-basis: auto;
        border-left: 1px solid color-mix(in srgb, currentColor 9%, transparent);
        background: var(--color-token-main-surface-primary, Canvas);
        box-shadow: -1px 0 0 color-mix(in srgb, currentColor 5%, transparent);
      }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-overview-collapse] {
        display: block;
        width: 28px;
        height: 28px;
        flex: 0 0 28px;
        border-radius: 5px;
        font-size: 22px;
      }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID}[data-collapsed="true"] {
        width: 40px;
        flex-basis: 40px;
      }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID}[data-collapsed="true"] > [data-codex-company-master-view] {
        display: none;
      }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID}[data-collapsed="true"] [data-codex-thread-overview-expand] {
        display: flex;
        align-items: center;
        flex-direction: column;
        gap: 8px;
        padding: 12px 0;
        font-size: 22px;
      }
      #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-overview-expand] span {
        writing-mode: vertical-rl;
        font-size: 12px;
        letter-spacing: 0;
      }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID} button:focus-visible {
        outline: 2px solid var(--color-border-focus, #3a83f7);
        outline-offset: -2px;
      }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-card {
        padding: 10px 0;
        border: 0;
        border-radius: 0;
        background: transparent;
      }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-card[hidden] {
        display: none;
      }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-mark {
        display: none;
      }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-add-memo] {
        border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
        background: transparent;
        color: inherit;
        box-shadow: none;
      }
      [data-codex-task-context-extras][hidden], [data-codex-task-context-extras] [hidden] {
        display: none !important;
      }
      [data-codex-task-context-extras] {
        font-size: 12px;
        line-height: 1.6;
      }
      [data-codex-task-context-extras] h3 {
        margin: 0 0 6px;
        font-size: 12px;
        font-weight: 650;
      }
      [data-codex-task-context-extras] p {
        margin: 4px 0 12px;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }
      [data-codex-task-context-extras] .codex-task-note-empty,
      [data-codex-task-context-extras] .codex-task-notes-empty,
      [data-codex-task-context-extras] .codex-task-hint {
        color: color-mix(in srgb, currentColor 70%, transparent);
        font-size: 11px;
      }
      [data-codex-task-context-extras] .codex-task-notes-empty {
        margin: 0 0 10px;
        max-width: 24em;
      }
      [data-codex-task-auto-context] { margin-bottom: 14px; }
      [data-codex-task-auto-context] > section { margin-bottom: 16px; }
      [data-codex-task-auto-context] > section > p { color: #c5cbd0; }
      [data-codex-task-auto-context] summary { cursor: pointer; font-weight: 650; }
      [data-codex-task-auto-agreements] { padding: 0 0 0 17px; margin: 8px 0 12px; }
      [data-codex-task-auto-agreements] li { margin: 6px 0; color: #b8c0c7; }
      [data-codex-task-auto-updated] { margin-top: 10px !important; }

      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-header { min-height: 44px; padding: 0 12px 0 14px; gap: 8px; }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-overview-heading] { display: block; font-size: 12px; font-weight: 650; }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-overview-status] {
        padding: 0;
        border-radius: 0;
        background: transparent;
        color: var(--color-token-text-secondary, color-mix(in srgb, currentColor 58%, transparent));
        font-size: 10px;
      }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-overview-status][data-running="true"] {
        background: transparent;
        color: #388ac9;
      }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-body {
        gap: 0;
        padding: 0 14px 14px;
      }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-title {
        margin: 0;
        padding: 13px 2px 12px;
        border-bottom: 0;
        color: var(--color-token-text-secondary, color-mix(in srgb, currentColor 66%, transparent));
        font-size: 12px;
        font-weight: 500;
        line-height: 16px;
      }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-header {
        border-bottom: 1px solid color-mix(in srgb, currentColor 8%, transparent);
      }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID} .codex-thread-overview-body {
        scrollbar-width: thin;
        scrollbar-color: color-mix(in srgb, currentColor 22%, transparent) transparent;
      }
      [data-codex-task-rail-tabs] { display: flex; align-self: stretch; flex: 1; gap: 16px; min-width: 0; }
      [data-codex-task-rail-tabs][hidden], [data-codex-task-skills][hidden], [data-codex-task-assets][hidden], [data-codex-task-context-extras][hidden] { display: none !important; }
      [data-codex-task-rail-tabs] button { padding: 0 2px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #969fa6; font-family: inherit; font-size: 12px; font-weight: 600; line-height: 1.2; cursor: pointer; white-space: nowrap; }
      [data-codex-task-rail-tabs] button[aria-pressed="true"] { color: #edf1f4; border-bottom-color: #85afd3; }
      [data-codex-task-rail-tabs] button:hover { color: #fff; }
      [data-codex-task-skills] button { color: #bdc5cc; background: transparent; border: 1px solid transparent; border-radius: 6px; padding: 6px 8px; cursor: pointer; font: inherit; }
      [data-codex-task-skills] button[aria-pressed="true"] { background: #ffffff0c; color: #e5eaf0; border-color: #ffffff18; }
      [data-codex-task-skills] button:hover { background: #ffffff0b; }
      [data-codex-task-skills] button:disabled { opacity: .45; cursor: default; }
      [data-codex-task-rail-tabs] button:focus-visible, [data-codex-task-skills] :is(input, button, summary):focus-visible { outline: 2px solid #85afd3; outline-offset: 2px; }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID}:not([data-task-pane="context"]) :is([data-codex-thread-overview-title], [data-codex-thread-add-memo], [data-codex-thread-overview-meta]) { display: none !important; }
      [data-codex-task-skills] { min-width: 0; font-size: 12px; }
      .codex-task-skills-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 8px; }
      .codex-task-skills-heading h3 { margin: 0; font-size: 13px; color: #eceff1; }
      .codex-task-skills-heading span, [data-task-skill-count], [data-task-skill-status] { color: #939da6; font-size: 11px; }
      [data-codex-task-skill-trace] {
        min-width: 0;
        padding: 14px 0 10px;
      }
      [data-codex-task-prompt-status] {
        min-width: 0;
        padding: 12px 0 10px;
        border-bottom: 1px solid #ffffff0c;
      }
      [data-codex-task-prompt-status] .codex-prompt-status-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 9px; }
      [data-codex-task-prompt-status] h3 { margin: 0; color: #eceff1; font-size: 13px; font-weight: 650; }
      [data-codex-task-prompt-status] [data-prompt-status-state] { color: #9da7af; font-size: 11px; }
      [data-codex-task-prompt-status][data-state="configured"] [data-prompt-status-state] { color: #8fc6a8; }
      [data-codex-task-prompt-status] .codex-prompt-status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
      [data-codex-task-prompt-status] .codex-prompt-status-grid .codex-prompt-status-cell:last-child { grid-column: 1 / -1; }
      [data-codex-task-prompt-status] .codex-prompt-status-cell { min-width: 0; padding: 7px 8px; border-radius: 7px; background: #ffffff06; }
      [data-codex-task-prompt-status] .codex-prompt-status-cell span { display: block; margin-bottom: 3px; color: #8e989f; font-size: 10px; }
      [data-codex-task-prompt-status] .codex-prompt-status-cell strong { display: block; overflow: hidden; color: #dce2e6; font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
      [data-codex-task-prompt-status] [data-prompt-status-hint] { margin: 8px 0 0; color: #8e989f; font-size: 10px; line-height: 15px; }
      [data-codex-task-skill-trace] .codex-task-skills-heading {
        margin: 0 0 6px;
        padding: 0 2px 8px;
      }
      [data-codex-task-skill-trace] .codex-task-skills-heading h3 {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: inherit;
        font-size: 12px;
        font-weight: 600;
      }
      [data-codex-task-skill-trace] .codex-task-skills-heading h3::before {
        content: "";
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #3aa675;
      }
      [data-codex-task-skill-trace] .codex-task-skills-heading span {
        color: var(--color-token-text-secondary, color-mix(in srgb, currentColor 58%, transparent));
        white-space: nowrap;
      }
      [data-skill-trace-list] {
        position: relative;
        display: grid;
        gap: 0;
        padding-left: 20px;
      }
      [data-skill-trace-list]::before {
        content: "";
        position: absolute;
        top: 19px;
        bottom: 19px;
        left: 6px;
        width: 1px;
        background: color-mix(in srgb, currentColor 14%, transparent);
      }
      .codex-skill-trace-node {
        position: relative;
        min-width: 0;
        padding: 11px 8px 11px 4px;
        border: 0;
        border-bottom: 1px solid color-mix(in srgb, currentColor 8%, transparent);
        background: transparent;
      }
      .codex-skill-trace-node::before {
        content: "";
        position: absolute;
        top: 17px;
        left: -18px;
        width: 6px;
        height: 6px;
        border: 2px solid var(--color-token-main-surface-primary, Canvas);
        border-radius: 50%;
        background: #929ba3;
        box-shadow: 0 0 0 1px #929ba3;
      }
      .codex-skill-trace-node[data-status="running"]::before {
        background: #388ac9;
        box-shadow: 0 0 0 1px #388ac9, 0 0 0 4px color-mix(in srgb, #388ac9 14%, transparent);
        animation: codex-skill-trace-pulse 1.6s ease-in-out infinite;
      }
      .codex-skill-trace-node[data-status="completed"]::before { background: #3aa675; box-shadow: 0 0 0 1px #3aa675; }
      .codex-skill-trace-node[data-status="failed"]::before { background: #d55454; box-shadow: 0 0 0 1px #d55454; }
      .codex-skill-trace-node[data-status="unknown"]::before { background: #b8842d; box-shadow: 0 0 0 1px #b8842d; }
      .codex-skill-trace-node-head { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
      .codex-skill-trace-node > strong {
        display: block;
        min-width: 0;
        overflow-wrap: anywhere;
        color: inherit;
        font-size: 13px;
        font-weight: 650;
        line-height: 18px;
      }
      .codex-skill-trace-node-head > strong {
        min-width: 0;
        flex: 1;
        overflow-wrap: anywhere;
        color: inherit;
        font-size: 13px;
        font-weight: 650;
        line-height: 18px;
      }
      .codex-skill-trace-status {
        flex: 0 0 auto;
        color: var(--color-token-text-secondary, color-mix(in srgb, currentColor 58%, transparent));
        font-size: 10px;
        line-height: 14px;
      }
      .codex-skill-trace-node[data-status="running"] .codex-skill-trace-status { color: #388ac9; }
      .codex-skill-trace-node[data-status="completed"] .codex-skill-trace-status { color: #2f9065; }
      .codex-skill-trace-node[data-status="failed"] .codex-skill-trace-status { color: #c94747; }
      .codex-skill-trace-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin-top: 4px;
        color: var(--color-token-text-secondary, color-mix(in srgb, currentColor 54%, transparent));
        font-size: 10px;
        line-height: 14px;
      }
      .codex-skill-trace-detail {
        margin: 6px 0 0;
        color: var(--color-token-text-secondary, color-mix(in srgb, currentColor 64%, transparent));
        font-size: 11px;
        line-height: 16px;
        overflow-wrap: anywhere;
      }
      .codex-skill-trace-detail[data-failure="true"] {
        padding: 7px 8px;
        border-radius: 6px;
        background: color-mix(in srgb, #d55454 8%, transparent);
        color: #c94747;
      }
      .codex-task-skill-trace-empty {
        margin: 0;
        padding: 14px 12px;
        border: 1px dashed color-mix(in srgb, currentColor 18%, transparent);
        border-radius: 7px;
        color: var(--color-token-text-secondary, color-mix(in srgb, currentColor 58%, transparent));
        font-size: 11px;
        line-height: 17px;
      }
      @keyframes codex-skill-trace-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: .58; transform: scale(.8); }
      }
      @media (prefers-reduced-motion: reduce) {
        .codex-skill-trace-node[data-status="running"]::before { animation: none; }
      }
      #${SKILL_ACTIVITY_TRIGGER_ID} {
        box-sizing: border-box;
        position: fixed;
        z-index: 40;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-width: 38px;
        height: 28px;
        padding: 0 8px;
        border: 1px solid transparent;
        border-radius: 6px;
        color: var(--color-token-text-tertiary, color-mix(in srgb, currentColor 62%, transparent));
        background: transparent;
        font: inherit;
        font-size: 12px;
        font-weight: 550;
        line-height: 1;
        cursor: pointer;
      }
      html:not([data-codex-task-shell="true"]) #${SKILL_ACTIVITY_TRIGGER_ID},
      html:not([data-codex-task-shell="true"]) #${SKILL_ACTIVITY_POPOVER_ID} {
        display: none !important;
      }
      #${SKILL_ACTIVITY_TRIGGER_ID}:hover,
      #${SKILL_ACTIVITY_TRIGGER_ID}[aria-expanded="true"] {
        color: var(--color-token-text-primary, currentColor);
        background: var(--color-token-bg-primary-ghost-hover, color-mix(in srgb, currentColor 7%, transparent));
      }
      #${SKILL_ACTIVITY_TRIGGER_ID}:focus-visible,
      #${SKILL_ACTIVITY_POPOVER_ID} button:focus-visible {
        outline: 2px solid var(--color-border-focus, #3a83f7);
        outline-offset: 1px;
      }
      #${SKILL_ACTIVITY_TRIGGER_ID} .codex-skill-activity-dot {
        width: 7px;
        height: 7px;
        flex: 0 0 7px;
        border-radius: 50%;
        background: #8d959c;
      }
      #${SKILL_ACTIVITY_TRIGGER_ID}[data-status="completed"] .codex-skill-activity-dot { background: #32936a; }
      #${SKILL_ACTIVITY_TRIGGER_ID}[data-status="running"] .codex-skill-activity-dot {
        background: #3788c8;
        box-shadow: 0 0 0 3px color-mix(in srgb, #3788c8 14%, transparent);
        animation: codex-skill-activity-pulse 1.6s ease-in-out infinite;
      }
      #${SKILL_ACTIVITY_TRIGGER_ID}[data-status="failed"] .codex-skill-activity-dot { background: #cf4b4b; }
      #${SKILL_ACTIVITY_TRIGGER_ID}[data-status="degraded"], #${SKILL_ACTIVITY_TRIGGER_ID}[data-status="disconnected"] { color: #a56d22; }
      #${SKILL_ACTIVITY_TRIGGER_ID}[data-status="degraded"] .codex-skill-activity-dot, #${SKILL_ACTIVITY_TRIGGER_ID}[data-status="disconnected"] .codex-skill-activity-dot { background: #bd7a24; }
      #${SKILL_ACTIVITY_POPOVER_ID} {
        --codex-skill-popover-bg: var(--color-token-main-surface-primary, Canvas);
        --codex-skill-popover-border: color-mix(in srgb, currentColor 12%, transparent);
        position: fixed;
        z-index: 90;
        box-sizing: border-box;
        width: min(316px, calc(100vw - 16px));
        max-height: min(480px, calc(100vh - 64px));
        overflow: hidden;
        border: 1px solid var(--codex-skill-popover-border);
        border-radius: 8px;
        background: var(--codex-skill-popover-bg);
        color: var(--color-token-text-primary, CanvasText);
        box-shadow: 0 8px 24px color-mix(in srgb, #000 10%, transparent), 0 1px 2px color-mix(in srgb, #000 8%, transparent);
      }
      html.electron-dark #${SKILL_ACTIVITY_POPOVER_ID} {
        --codex-skill-popover-bg: #202224;
        --codex-skill-popover-border: #ffffff1a;
        color: #edf0f2;
        box-shadow: 0 6px 18px #00000042, 0 0 0 1px #ffffff0d;
      }
      #${SKILL_ACTIVITY_POPOVER_ID} .codex-skill-activity-header {
        display: flex;
        align-items: center;
        min-height: 48px;
        padding: 0 10px 0 15px;
        border-bottom: 1px solid var(--codex-skill-popover-border);
      }
      #${SKILL_ACTIVITY_POPOVER_ID} h2 {
        margin: 0;
        font-size: 13px;
        font-weight: 650;
        line-height: 18px;
      }
      #${SKILL_ACTIVITY_POPOVER_ID} [data-codex-skill-activity-summary] {
        margin-left: 8px;
        color: var(--color-token-text-secondary, color-mix(in srgb, currentColor 58%, transparent));
        font-size: 11px;
      }
      #${SKILL_ACTIVITY_POPOVER_ID}[data-status="running"] [data-codex-skill-activity-summary] { color: #3788c8; }
      #${SKILL_ACTIVITY_POPOVER_ID}[data-status="failed"] [data-codex-skill-activity-summary] { color: #cf4b4b; }
      #${SKILL_ACTIVITY_POPOVER_ID} [data-codex-skill-activity-close] {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        margin-left: auto;
        padding: 0;
        border: 0;
        border-radius: 6px;
        color: var(--color-token-text-secondary, color-mix(in srgb, currentColor 62%, transparent));
        background: transparent;
        font: inherit;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
      }
      #${SKILL_ACTIVITY_POPOVER_ID} [data-codex-skill-activity-close]:hover {
        color: inherit;
        background: color-mix(in srgb, currentColor 7%, transparent);
      }
      #${SKILL_ACTIVITY_POPOVER_ID} [data-codex-skill-activity-error] {
        margin: 0;
        padding: 8px 13px;
        border-bottom: 1px solid var(--codex-skill-popover-border);
        color: #bd7a24;
        font-size: 11px;
        line-height: 16px;
      }
      #${SKILL_ACTIVITY_POPOVER_ID}[data-status="disconnected"] [data-codex-skill-activity-summary] { color: #bd7a24; }
      #${SKILL_ACTIVITY_POPOVER_ID} [data-codex-task-skill-trace] {
        max-height: min(432px, calc(100vh - 112px));
        padding: 5px 10px 7px;
        overflow: auto;
        scrollbar-width: thin;
      }
      #${SKILL_ACTIVITY_POPOVER_ID} .codex-task-skills-heading { display: none; }
      #${SKILL_ACTIVITY_POPOVER_ID} [data-skill-trace-list] { padding-left: 0; }
      #${SKILL_ACTIVITY_POPOVER_ID} [data-skill-trace-list]::before { display: none; }
      #${SKILL_ACTIVITY_POPOVER_ID} .codex-skill-trace-node {
        display: grid;
        grid-template-columns: 18px minmax(0, 1fr);
        column-gap: 10px;
        padding: 10px 6px;
        border-bottom: 1px solid color-mix(in srgb, currentColor 7%, transparent);
      }
      #${SKILL_ACTIVITY_POPOVER_ID} .codex-skill-trace-node::before {
        position: static;
        grid-row: 1 / span 2;
        box-sizing: border-box;
        width: 18px;
        height: 18px;
        margin-top: 0;
        border: 5px solid color-mix(in srgb, currentColor 7%, transparent);
        background-clip: padding-box;
        box-shadow: none !important;
      }
      #${SKILL_ACTIVITY_POPOVER_ID} .codex-skill-trace-node-head { align-items: center; gap: 8px; }
      #${SKILL_ACTIVITY_POPOVER_ID} .codex-skill-trace-node-head > strong { font-size: 12px; line-height: 18px; font-weight: 600; }
      #${SKILL_ACTIVITY_POPOVER_ID} .codex-skill-trace-status {
        padding: 0;
        border-radius: 0;
        background: transparent;
        font-size: 10px;
        line-height: 16px;
      }
      #${SKILL_ACTIVITY_POPOVER_ID} .codex-skill-trace-node[data-status="completed"] .codex-skill-trace-status { color: #45976f; }
      #${SKILL_ACTIVITY_POPOVER_ID} .codex-skill-trace-meta { gap: 0; margin-top: 2px; font-size: 10px; line-height: 15px; }
      #${SKILL_ACTIVITY_POPOVER_ID} .codex-skill-trace-meta span + span::before { content: "·"; margin: 0 6px; opacity: .65; }
      #${SKILL_ACTIVITY_POPOVER_ID} .codex-skill-trace-detail { grid-column: 2; }
      #${SKILL_ACTIVITY_POPOVER_ID} .codex-skill-trace-node:last-child { border-bottom: 0; }
      #${SKILL_ACTIVITY_POPOVER_ID} .codex-skill-trace-node::before {
        left: auto;
        border-color: var(--codex-skill-popover-bg);
      }
      #${SKILL_ACTIVITY_POPOVER_ID} .codex-task-skill-trace-empty {
        margin: 8px 0;
        padding: 18px 12px;
        border: 0;
        text-align: center;
      }
      @keyframes codex-skill-activity-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: .5; }
      }
      @media (prefers-reduced-motion: reduce) {
        #${SKILL_ACTIVITY_TRIGGER_ID}[data-status="running"] .codex-skill-activity-dot { animation: none; }
      }
      .codex-task-skill-defaults { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 18px; color: #b8c1c9; }
      .codex-task-skill-defaults > span { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 6px 9px; border-radius: 6px; background: #ffffff06; border: 1px solid #ffffff10; }
      .codex-task-skill-defaults > span > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      [data-codex-task-skills] .codex-task-skill-defaults button { flex: 0 0 auto; padding: 2px 4px; min-height: 24px; font-size: 11px; white-space: nowrap; }
      [data-task-skill-default-hint] { margin: 0; color: #939da6; font-size: 11px; line-height: 1.5; }
      [data-codex-task-skills] [data-task-skill-default-add] { border-color: #ffffff24; color: #bdd5e9; white-space: nowrap; }
      [data-task-default-picker="true"] [data-task-skill-search] { border-color: #85afd370; }
      [data-task-skill-search] { box-sizing: border-box; width: 100%; padding: 9px 10px; border: 1px solid #ffffff26; border-radius: 7px; background: #ffffff05; color: #eceff1; font: inherit; }
      .codex-task-skill-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin: 10px 0; }
      .codex-task-skill-summary { display: flex; align-items: baseline; gap: 10px; margin: 12px 0; }
      [data-task-skill-count] { margin-left: auto; white-space: nowrap; }
      [data-task-skill-status] { margin: 0; }
      .codex-task-skill-group { margin-bottom: 10px; }
      .codex-task-skill-group > summary { padding: 9px 2px; color: #afb9c2; cursor: pointer; font-size: 11px; font-weight: 600; }
      .codex-task-skill-row { display: flex; align-items: center; gap: 4px; border-bottom: 1px solid #ffffff0b; padding: 4px 0; }
      [data-codex-task-skills] .codex-task-skill-invoke { flex: 1; min-width: 0; text-align: left; padding: 10px 6px; }
      .codex-task-skill-invoke strong { display: block; overflow-wrap: anywhere; font-size: 12px; font-weight: 600; color: #e0e5e9; }
      .codex-task-skill-invoke span { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 5px; font-size: 11px; line-height: 1.5; color: #a0aab3; }
      [data-codex-task-skills] .codex-task-skill-star { flex: 0 0 28px; padding: 5px; font-size: 17px; }
      #${THREAD_OVERVIEW_RAIL_ID}[data-task-pane="assets"] .codex-thread-overview-body { padding: 0; gap: 0; overflow: hidden; }
      [data-codex-task-assets] { display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0; font-size: 12px; color: #c5cbd0; }
      [data-task-asset-console-host] { display: flex; flex: 1; min-height: 0; min-width: 0; }
      [data-task-asset-console-host] #${ASSET_CONSOLE_PANEL_ID} .codex-asset-console-header {
        position: absolute; z-index: 12; top: 10px; right: 12px; width: auto; height: 32px;
        padding: 0; gap: 2px; border: 0; background: transparent;
      }
      [data-task-asset-console-host] #${ASSET_CONSOLE_PANEL_ID} :is(.codex-asset-console-title,.codex-asset-console-local,.codex-asset-console-spacer) { display: none; }
      [data-task-asset-console-host] #${ASSET_CONSOLE_PANEL_ID} .codex-asset-console-action { padding: 0; }
      [data-task-asset-console-host] #${ASSET_CONSOLE_PANEL_ID},
      [data-task-asset-console-host] #${ASSET_CONSOLE_PANEL_ID}[data-docked="true"] { grid-template-rows: minmax(0, 1fr); }
      [data-task-asset-console-host] #${ASSET_CONSOLE_PANEL_ID} [data-codex-asset-console-close] { display: none; }
      [data-codex-asset-console-expand][hidden] { display: none !important; }
      [data-codex-task-assets] h3 { margin: 0 0 12px; font-size: 13px; color: #eceff1; }
      [data-codex-task-assets] .codex-task-hint { color: #959fa8; font-size: 11px; line-height: 1.6; margin: 8px 0 12px; }
      [data-codex-task-assets] :is(button,input) { font: inherit; color: inherit; border: 1px solid #ffffff20; background: #ffffff04; border-radius: 6px; padding: 7px 9px; }
      [data-codex-task-assets] button { cursor: pointer; }
      [data-codex-task-assets] button:hover { background: #ffffff0a; }
      [data-codex-task-assets] button:disabled { opacity: .5; cursor: default; }
      [data-codex-task-assets] :is(button,input,summary):focus-visible { outline: 2px solid #85afd3; outline-offset: 2px; }
      [data-codex-task-assets] input { display: block; width: 100%; box-sizing: border-box; margin: 6px 0 10px; }
      [data-codex-task-assets] label { display: block; margin: 10px 0; }
      [data-codex-task-assets] ul { list-style: none; padding: 0; margin: 0 0 20px; }
      [data-codex-task-assets] li { margin: 6px 0; }
      :is([data-codex-task-assets], [data-codex-task-cold]) li button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px; text-align: left; border-color: #ffffff0c; }
      .codex-task-resource-kind { flex: 0 0 34px; text-align: center; padding: 5px 0; border-radius: 4px; color: #acbcca; background: #ffffff06; font-size: 10px; }
      .codex-task-resource-copy { flex: 1; min-width: 0; }
      .codex-task-resource-copy strong { display: block; font-size: 12px; font-weight: 500; line-height: 1.5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .codex-task-resource-copy small { display: block; margin-top: 3px; font-size: 10px; color: #89949e; }
      [data-codex-task-cold] { margin-top: 18px; padding-top: 12px; border-top: 1px solid #ffffff12; }
      [data-codex-task-cold] ul { list-style: none; padding: 0; }
      [data-codex-task-assets] summary { padding: 6px 0; cursor: pointer; }
      [data-codex-task-assets] [role="status"]:empty { display: none; }
      [data-codex-task-context-extras] .codex-task-excerpt {
        margin-top: 18px;
        padding-top: 10px;
        border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent);
      }
      [data-codex-task-context-extras] .codex-task-excerpt > summary {
        font-size: 11px;
        color: color-mix(in srgb, currentColor 72%, transparent);
      }
      [data-codex-task-context-extras] .codex-task-excerpt > p {
        margin: 8px 0 0;
        font-size: 12px;
        line-height: 1.7;
      }
      html[data-codex-task-shell="true"] #${THREAD_OVERVIEW_RAIL_ID} [data-codex-thread-add-memo][hidden] {
        display: none;
      }
      [data-codex-task-context-extras] button {
        min-height: 30px;
        padding: 4px 9px;
        border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
        border-radius: 6px;
        color: inherit;
        background: transparent;
        font: inherit;
        cursor: pointer;
      }
      [data-codex-task-context-extras] button:hover {
        background: color-mix(in srgb, currentColor 8%, transparent);
      }
      [data-codex-task-context-extras] button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      [data-codex-task-context-extras] label { display: block; margin: 8px 0; }
      [data-codex-task-context-extras] :is(textarea, input) {
        display: block;
        box-sizing: border-box;
        width: 100%;
        margin: 5px 0 10px;
        padding: 8px;
        border: 1px solid color-mix(in srgb, currentColor 24%, transparent);
        border-radius: 6px;
        background: color-mix(in srgb, currentColor 4%, transparent);
        color: inherit;
        font: inherit;
        resize: vertical;
      }
      [data-codex-task-context-extras] :is(textarea, input, summary):focus-visible {
        outline: 2px solid var(--color-border-focus, #3a83f7);
        outline-offset: 2px;
      }
      [data-codex-task-context-extras] .codex-task-actions { display: flex; gap: 6px; flex-wrap: wrap; }
      [data-codex-task-context-extras] [data-codex-task-notes-error]:empty,
      [data-codex-task-context-extras] [data-task-cold-status]:empty { display: none; }
      [data-codex-task-context-extras] [data-codex-task-notes-error] { color: #edaa82; }
      [data-codex-task-context-extras] .codex-task-resources {
        margin-top: 18px;
        padding-top: 14px;
        border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent);
      }
      [data-codex-task-context-extras] ul { list-style: none; padding: 0; margin: 4px 0 14px; }
      [data-codex-task-context-extras] li button {
        width: 100%; border: 0; padding: 5px 0; text-align: left;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      [data-codex-task-context-extras] summary { padding: 5px 0; cursor: pointer; }
      [data-task-cold-state] { float: right; font-size: 10px; opacity: 0.7; }
      @media (prefers-reduced-motion: reduce) {
        html[data-codex-conversation-view="card"] [data-sidebar-project-kind] > .overflow-hidden {
          transition: none !important;
        }
        html[data-codex-task-shell="true"] #${SHORTCUT_GRID_ID} .${SHORTCUT_CARD_CLASS} {
          transition: none;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function rowKey(row) {
    const id = row.getAttribute("data-app-action-sidebar-thread-id")
      || row.closest("[data-sidebar-chatgpt-conversation-key]")?.getAttribute("data-sidebar-chatgpt-conversation-key")
      || "";
    const title = row.getAttribute("data-app-action-sidebar-thread-title")
      || row.querySelector("[data-thread-title]")?.textContent?.trim()
      || "";
    return `${id}\n${title}`;
  }

  function sidebarTaskRoot() {
    return document.querySelector("[data-app-action-sidebar-scroll]")
      || document.querySelector(".app-shell-left-panel");
  }

  function clearNonSidebarTaskEnhancements() {
    const root = sidebarTaskRoot();
    document.querySelectorAll('[data-codex-conversation-preview-enhanced="true"]').forEach((row) => {
      if (root?.contains(row)) return;
      row.removeAttribute("data-codex-conversation-preview-enhanced");
      row.removeAttribute("data-codex-conversation-preview-title");
      row.querySelectorAll(`.${SUMMARY_CLASS}, .${DETAILS_CLASS}, .${CARD_CONTENT_CLASS}`).forEach((node) => node.remove());
      row.closest('[data-codex-conversation-card-item="true"]')?.removeAttribute("data-codex-conversation-card-item");
    });
    document.querySelectorAll('[data-codex-conversation-card-grid="true"]').forEach((grid) => {
      if (!root?.contains(grid)) grid.removeAttribute("data-codex-conversation-card-grid");
    });
  }

  function clearSidebarTaskEnhancements() {
    const root = sidebarTaskRoot();
    if (!root) return;
    root.querySelectorAll('[data-codex-conversation-preview-enhanced="true"]').forEach((row) => {
      row.removeAttribute("data-codex-conversation-preview-enhanced");
      row.removeAttribute("data-codex-conversation-preview-title");
      row.querySelectorAll(`.${SUMMARY_CLASS}, .${DETAILS_CLASS}, .${CARD_CONTENT_CLASS}`).forEach((node) => node.remove());
      row.closest('[data-codex-conversation-card-item="true"]')?.removeAttribute("data-codex-conversation-card-item");
    });
    root.querySelectorAll('[data-codex-conversation-card-grid="true"]').forEach((grid) => {
      grid.removeAttribute("data-codex-conversation-card-grid");
    });
  }

  function visibleRows() {
    const root = sidebarTaskRoot();
    if (!root) return [];
    return Array.from(root.querySelectorAll(`${ROW_SELECTOR}, ${CHATGPT_ROW_SELECTOR}`))
      .filter((row, index, rows) => row.isConnected && rows.indexOf(row) === index);
  }

  function cleanTaskPreviewText(value, fallback = "") {
    const clean = (text) => String(text || "")
      .replace(/\{\{\s*(?:Image|Video|Audio|File)\s+\d+\s*\}\}/gi, " ")
      .replace(/:::writing\b[^\r\n}]*\}?/gi, "")
      .replace(/:::/g, "")
      .replace(/```[^\r\n]*\r?\n|```|~~~/g, "")
      .replace(/!\[\s*\]\([^)]*\)/g, " ")
      .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/(^|\n)\s{0,3}(?:#{1,6}\s+|>\s*|[-+*]\s+|\d+[.)]\s+)/g, "$1")
      .replace(/\*{1,3}([^*]+)\*{1,3}|`([^`]+)`|~~([^~]+)~~/g, "$1$2$3")
      .replace(/(^|\s)_{1,2}([^_]+)_{1,2}(?=\s|[.,!?:;，。！？：；]|$)/g, "$1$2")
      .replace(/\s+/g, " ")
      .trim();
    return clean(value) || clean(fallback);
  }

  function applySummary(row, preview) {
    const titleHost = row.querySelector("[data-thread-title-trigger=\"true\"]");
    if (!titleHost) return;
    row.setAttribute("data-codex-conversation-preview-enhanced", "true");
    const cardItem = row.closest('[role="listitem"]');
    cardItem?.setAttribute("data-codex-conversation-card-item", "true");
    cardItem?.parentElement?.setAttribute("data-codex-conversation-card-grid", "true");
    titleHost.setAttribute("data-codex-conversation-preview-title", "true");
    let summary = titleHost.querySelector(`.${SUMMARY_CLASS}`);
    if (!summary) {
      summary = document.createElement("div");
      summary.className = SUMMARY_CLASS;
      titleHost.appendChild(summary);
    }
    const preserveProject = !isTaskShell();
    const value = (preserveProject ? preview?.summary
      : cleanTaskPreviewText(preview?.summary, preview?.recentOutput)) || "暂无本地摘要";
    if (summary.textContent !== value) summary.textContent = value;
    summary.title = value;
    applyCardDetails(row, preview);
  }

  function formatTaskCardTitle(title, value) {
    const parts = value.split("｜");
    for (const [attribute, text] of [
      ["data-codex-card-main", parts.length === 2 ? parts[0].trim() : ""],
      ["data-codex-card-qualifier", parts.length === 2 ? parts[1].trim() : ""],
    ]) {
      if (parts.length === 2 && parts.every((part) => part.trim())) {
        if (title.getAttribute(attribute) !== text) title.setAttribute(attribute, text);
      } else title.removeAttribute(attribute);
    }
  }

  function applyCardDetails(row, preview) {
    let card = Array.from(row.children).find((node) => node.classList?.contains(CARD_CONTENT_CLASS));
    if (!card) {
      card = document.createElement("div");
      card.className = CARD_CONTENT_CLASS;
      card.setAttribute("aria-hidden", "true");
      const title = document.createElement("div");
      title.className = CARD_TITLE_CLASS;
      const time = document.createElement("div");
      time.className = TIME_CLASS;
      const summary = document.createElement("div");
      summary.className = CARD_SUMMARY_CLASS;
      const tags = document.createElement("div");
      tags.className = TAGS_CLASS;
      card.append(title, time, summary, tags);
      row.appendChild(card);
    }

    const title = card.querySelector(`.${CARD_TITLE_CLASS}`);
    const time = card.querySelector(`.${TIME_CLASS}`);
    const summary = card.querySelector(`.${CARD_SUMMARY_CLASS}`);
    const tags = card.querySelector(`.${TAGS_CLASS}`);
    const titleValue = row.getAttribute("data-app-action-sidebar-thread-title")
      || row.querySelector("[data-thread-title]")?.textContent?.trim()
      || "未命名对话";
    const preserveProject = !isTaskShell();
    const summaryValue = (preserveProject ? preview?.summary
      : cleanTaskPreviewText(preview?.summary, preview?.recentOutput)) || "暂无本地摘要";
    title.textContent = titleValue;
    title.title = titleValue;
    formatTaskCardTitle(title, titleValue);
    const updatedAt = Date.parse(preview?.updatedAt || "");
    const hasUpdate = Number.isFinite(updatedAt);
    time.textContent = formatCardUpdatedAt(updatedAt);
    time.title = hasUpdate
      ? `本地索引更新时间：${new Date(updatedAt).toLocaleString("zh-CN")}`
      : "未获取到本地更新时间";
    summary.textContent = summaryValue;
    summary.title = summaryValue;

    const subjectFallback = titleValue
      .replace(/^(创建|构建|优化|更新|安装|调研|查找|梳理|整理|生成|制作)+/u, "")
      .replace(/skills?/ig, "")
      .trim()
      .slice(0, 8) || "任务主题";
    let values = Array.isArray(preview?.tags) && preview.tags.length
      ? preview.tags.slice(0, 3)
      : [subjectFallback, "摘要未提供", "真实数据"];
    if (preserveProject) {
      while (values.length < 3) values.push(["任务主题", "摘要未提供", "真实数据"][values.length]);
    } else {
      const genericTags = /^(任务主题|摘要未提供|真实数据|需求处理|需求梳理|成果整理|阶段成果|持续推进|阶段完成|问题已解决|交付完成|待付费提交|待计费提交|版本定稿|方案已准备|部署完成|Skill交付|验收通过|成果交付|通用交付)$/i;
      values = [...new Set((Array.isArray(preview?.tags) ? preview.tags : [])
        .map((value) => cleanTaskPreviewText(value)).filter((value) => value && !genericTags.test(value)))].slice(0, 2);
    }
    const signature = values.join("\n");
    if (tags.dataset.values !== signature) {
      tags.dataset.values = signature;
      tags.replaceChildren(...values.map((value) => {
        const tag = document.createElement("span");
        tag.textContent = value;
        tag.title = value;
        return tag;
      }));
    }
  }

  function switchIcon(mode) {
    // The control describes the view it will switch to, matching native
    // toolbar semantics: cards show the compact-list glyph and lists show the
    // grid glyph.
    if (mode === "card") {
      return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 3.5h10M3 8h10M3 12.5h10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
    }
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2.25" y="2.25" width="4.75" height="4.75" rx="1.25" stroke="currentColor" stroke-width="1.2"/><rect x="9" y="2.25" width="4.75" height="4.75" rx="1.25" stroke="currentColor" stroke-width="1.2"/><rect x="2.25" y="9" width="4.75" height="4.75" rx="1.25" stroke="currentColor" stroke-width="1.2"/><rect x="9" y="9" width="4.75" height="4.75" rx="1.25" stroke="currentColor" stroke-width="1.2"/></svg>`;
  }

  function isTaskShell() {
    // The Projects section can be expanded while the main view is still the
    // task list. Grouping tasks by project must not switch those rows back to
    // the legacy generic card skin. Only the actual project-management page
    // opts out of task-card rendering.
    if (document.documentElement.getAttribute(COMPANY_WORKBENCH_MODE_ATTR) === "true") return false;
    if (isProjectManagementPage()) return false;
    // A newly opened conversation uses the native home composer until its
    // first message creates a thread. Keep task cards and their controls
    // available throughout that transition. Native Plugins, Scheduled Tasks,
    // Pull Requests, Asset Library, and Projects have no composer placement.
    return Boolean(document.querySelector(
      '[data-composer-placement="thread"], [data-composer-placement="home"], [data-above-composer-conversation-id], [data-conversation-turn-id]'
    ));
  }

  function isProjectManagementPage() {
    const main = document.querySelector("main");
    if (!main) return false;
    if (main.querySelector("[data-project-row], [data-projects-rows]")) return true;
    const heading = main.querySelector("h1, h2");
    return heading?.textContent?.trim() === "项目" && /搜索项目|已更新/.test(main.textContent || "");
  }

  function currentViewMode() {
    // The switch controls task rows in the sidebar. Opening the native Projects
    // page must not silently swap those rows to the unrelated legacy mode.
    return taskViewMode;
  }

  function restoreTaskViewPreference() {
    // SPA navigation can briefly render a workspace without a composer before
    // the conversation shell mounts. During that gap the non-task branch
    // writes a list data attribute and removes card decorations. Re-read the
    // persisted preference whenever the task shell is present so returning to
    // a conversation deterministically restores the user's last mode.
    if (!isTaskShell()) return;
    try {
      const stored = localStorage.getItem(TASK_VIEW_STORAGE_KEY);
      if (stored === "card" || stored === "list") taskViewMode = stored;
    } catch {}
  }

  function updateViewState() {
    restoreTaskViewPreference();
    const mode = currentViewMode();
    const taskShell = isTaskShell();
    document.documentElement.setAttribute("data-codex-task-shell", String(taskShell));
    document.documentElement.setAttribute("data-codex-conversation-view", taskShell ? mode : "list");
    const button = document.getElementById(TOGGLE_ID);
    if (!button) return;
    button.hidden = !taskShell || isProjectManagementPage();
    const isCard = mode === "card";
    const label = taskShell
      ? isCard ? "卡片视图，切换为紧凑列表" : "紧凑列表，切换为卡片视图"
      : isCard ? "卡片视图已开启，切换为列表视图" : "卡片视图已关闭，切换为卡片视图";
    button.setAttribute("aria-checked", String(isCard));
    button.setAttribute("aria-label", label);
    button.title = label;
    if (button.dataset.mode !== mode || !button.querySelector(`.${SWITCH_THUMB_CLASS}`)) {
      button.dataset.mode = mode;
      button.innerHTML = `<span class="${SWITCH_THUMB_CLASS}" aria-hidden="true">${switchIcon(mode)}</span>`;
    }
  }

  function handleViewToggle(event) {
    event.preventDefault();
    event.stopPropagation();
    const mode = currentViewMode() === "card" ? "list" : "card";
    taskViewMode = mode;
    try { localStorage.setItem(TASK_VIEW_STORAGE_KEY, mode); } catch {}
    layoutAnchored = false;
    updateViewState();
    scheduleSync();
  }

  function shortcutLabel(button) {
    return button?.querySelector(".text-fade-truncate")?.textContent?.trim()
      || button?.getAttribute("title")
      || button?.getAttribute("aria-label")?.replace(/^打开/u, "")
      || "快捷入口";
  }

  function findNativeShortcutButton(name) {
    return Array.from(document.querySelectorAll("button")).find((button) =>
      !button.closest(`#${SHORTCUT_GRID_ID}`) && shortcutLabel(button) === name,
    );
  }

  function currentCodexTaskContext() {
    const selected = document.querySelector('[data-app-action-sidebar-thread-id][data-app-action-sidebar-thread-selected="true"]')
      || document.querySelector('[data-app-action-sidebar-thread-id][data-selected="true"]')
      || document.querySelector('[data-app-action-sidebar-thread-id][aria-current="page"]')
      || document.querySelector('[data-app-action-sidebar-thread-id][data-active="true"]')
      || document.querySelector('[data-app-action-sidebar-thread-id][data-app-action-sidebar-thread-active="true"]');
    const selectedId = (selected?.getAttribute("data-app-action-sidebar-thread-id") || "").replace(/^(local|cloud):/, "");
    const rawId = document.querySelector('[data-above-composer-conversation-id]')?.getAttribute("data-above-composer-conversation-id") || selectedId;
    const threadId = rawId.replace(/^(local|cloud):/, "");
    return {
      threadId,
      threadTitle: (threadId === selectedId ? selected?.getAttribute("data-app-action-sidebar-thread-title") : "")
        || currentThreadHeaderTitle()
        || "当前 Codex 任务",
    };
  }

  function compactThreadText(value, limit = 280) {
    return String(value || "").replace(/\s+/gu, " ").trim().slice(0, limit);
  }

  function currentThreadHeaderTitle() {
    return Array.from(document.querySelectorAll('[data-testid="app-shell-header-context-menu-surface"] button'))
      .find((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 20 && rect.height > 16 && compactThreadText(button.textContent);
      })?.textContent?.trim() || "";
  }

  function assistantTextFromTurn(turn) {
    const nodes = turn?.querySelectorAll(
      '[data-response-annotation-conversation][data-response-annotation-target] [data-markdown-text-style="assistant-message"], '
      + '[data-local-conversation-final-assistant="true"] [data-markdown-text-style="assistant-message"]',
    ) || [];
    return compactThreadText(Array.from(new Set(Array.from(nodes, (node) => compactThreadText(node.innerText))))
      .filter(Boolean).join(" "), 360);
  }

  function deriveThreadNextStep(assistantText) {
    // ponytail: keyword extraction is intentionally local; use a model-backed summary only if long-thread accuracy becomes limiting.
    const candidate = String(assistantText || "").split(/[。！？；\n]+/u)
      .map((part) => compactThreadText(part, 180))
      .find((part) => /下一步|接下来|待办|请确认|需要你/u.test(part));
    return candidate || "等待你的下一条要求";
  }

  function readCurrentThreadSnapshot() {
    const conversation = document.querySelector('[data-thread-find-target="conversation"]');
    if (!conversation) return null;
    const turns = Array.from(conversation.querySelectorAll("[data-turn-key]"));
    const userMessages = turns.map((turn) => compactThreadText(
      turn.querySelector('[data-local-conversation-user-anchor="true"] [data-user-message-bubble="true"]')?.innerText,
      320,
    )).filter(Boolean);
    if (!userMessages.length) return null;
    const assistantMessages = turns.map(assistantTextFromTurn).filter(Boolean);
    const latestUser = userMessages.at(-1) || "当前要求";
    const latestAssistant = assistantMessages.at(-1) || "尚未形成可记录的进展";
    const recentProgress = compactThreadText(assistantMessages.slice(-3).join(" · "), 720)
      || "尚未形成可记录的进展";
    const lastTurn = turns.at(-1);
    const running = Boolean(document.querySelector(
      '[data-composer-placement="thread"] button[aria-label="停止"]:not(:disabled), '
      + '[data-composer-placement="thread"] button[aria-label="Stop"]:not(:disabled)',
    ));
    const pending = !running
      && Boolean(lastTurn?.querySelector('[data-local-conversation-user-anchor="true"]'))
      && !lastTurn?.querySelector('[data-local-conversation-final-assistant="true"]');
    const task = currentCodexTaskContext();
    const title = compactThreadText(
      task.threadTitle === "当前 Codex 任务" ? currentThreadHeaderTitle() : task.threadTitle,
      120,
    ) || "当前 Codex 任务";
    const threadId = document.querySelector("[data-above-composer-conversation-id]")
      ?.getAttribute("data-above-composer-conversation-id")
      || document.querySelector("[data-response-annotation-conversation]")
        ?.getAttribute("data-response-annotation-conversation")
      || task.threadId;
    const progress = running
      ? compactThreadText(`正在处理：${latestUser}；上一进展：${latestAssistant}`, 360)
      : pending
        ? compactThreadText(`等待继续处理：${latestUser}`, 360)
        : latestAssistant;
    return {
      threadId: compactThreadText(threadId, 160),
      title,
      goal: userMessages[0],
      currentRequest: latestUser,
      progress: running || pending ? progress : recentProgress,
      latestAnswer: assistantMessages.at(-1) || "",
      summary: compactThreadText(assistantMessages.length
        ? `围绕「${title}」，目前进展：${latestAssistant}${running || pending ? `；当前正在处理：${latestUser}` : ""}`
        : `这是关于「${title}」的任务，正在处理当前要求。`, 280),
      nextStep: running
        ? compactThreadText(`完成当前要求：${latestUser}`, 220)
        : pending
          ? compactThreadText(`继续处理当前要求：${latestUser}`, 220)
          : deriveThreadNextStep(latestAssistant),
      status: running ? "进行中" : pending ? "待继续" : "已同步",
      running,
      turnCount: userMessages.length,
      historyComplete: false,
    };
  }

  function resolvedCurrentThreadSnapshot() {
    const dom = readCurrentThreadSnapshot();
    const saved = threadOverview && typeof threadOverview === "object" ? threadOverview : null;
    if (!saved) return dom;
    const normalizeId = (value) => compactThreadText(value, 160).replace(/^(?:local|cloud):/iu, "").toLowerCase();
    const domId = normalizeId(dom?.threadId);
    const savedId = normalizeId(saved.threadId);
    if (domId && savedId && domId !== savedId) return dom;
    const currentRequest = compactThreadText(saved.currentRequest || dom?.currentRequest, 360);
    const running = Boolean(dom?.running || saved.running);
    const pending = !running && dom?.status === "待继续";
    return {
      threadId: savedId || domId,
      title: compactThreadText(saved.title || dom?.title, 120) || "当前 Codex 任务",
      goal: compactThreadText(saved.goal || dom?.goal, 520) || "尚未识别任务目标",
      currentRequest: currentRequest || "当前要求未提取",
      progress: compactThreadText(saved.progress || dom?.progress, 900) || "尚未形成可记录的进展",
      latestAnswer: dom?.latestAnswer || "",
      summary: compactThreadText(saved.summary || dom?.summary || saved.progress || dom?.progress, 320)
        || "尚未形成可用总结",
      nextStep: compactThreadText(saved.nextStep || dom?.nextStep, 360) || "等待你的下一条要求",
      status: running ? "进行中" : pending ? "待继续" : compactThreadText(saved.status, 20) || dom?.status || "已同步",
      running,
      turnCount: Number.isFinite(Number(saved.turnCount)) ? Number(saved.turnCount) : dom?.turnCount || 0,
      historyComplete: true,
      taskContext: saved.taskContext || null,
    };
  }

  function assetConsoleTaskContextKey(context = currentCodexTaskContext()) {
    return `${context.threadId}\u0000${context.threadTitle}`;
  }

  function activeConsoleKind() {
    return document.getElementById(ASSET_CONSOLE_PANEL_ID)?.dataset.consoleKind || "asset";
  }

  function notifyAssetConsole(action, panel = activeConsoleKind()) {
    const opener = panel === "skill" ? window.codexSidebarOpenSkillConsole : window.codexSidebarOpenAssetConsole;
    if (typeof opener !== "function") return false;
    try {
      opener(JSON.stringify({
        action,
        panel,
        source: "sidebar",
        at: Date.now(),
        theme: document.documentElement.classList.contains("electron-dark") ? "dark" : "light",
        ...(action === "open" ? currentCodexTaskContext() : {}),
      }));
      return true;
    } catch {
      return false;
    }
  }

  function currentComposer() {
    return Array.from(document.querySelectorAll('[contenteditable="true"]')).find((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 80 && rect.height > 20 && !node.closest(`#${ASSET_CONSOLE_PANEL_ID}`);
    }) || null;
  }

  function addTextToComposer(value, targetComposer = null) {
    const valueText = typeof value === "string" ? value.trim() : "";
    if (!valueText) return false;
    const composer = targetComposer || currentComposer();
    if (!composer) return false;
    const prefix = composer.textContent?.trim() ? "\n" : "";
    const text = `${prefix}${valueText}`;
    composer.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(composer);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
    let inserted = false;
    try { inserted = document.execCommand("insertText", false, text); } catch {}
    if (!inserted) {
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    composer.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: text,
    }));
    return true;
  }

  function addAssetReferencesToComposer(assetPaths) {
    const controller = taskSkillComposerController();
    const type = controller?.view.state.schema.nodes.atMention;
    if (!type || !Array.isArray(assetPaths) || !assetPaths.length || !assetPaths.every(isAbsoluteWindowsAssetPath)) return false;
    const present = new Set(taskComposerAssetReferences(controller).map((entry) => taskAssetReferenceKey(entry.fsPath || entry.path)));
    const mentions = [];
    for (const value of assetPaths) {
      const path = value.trim();
      const key = taskAssetReferenceKey(path);
      if (present.has(key)) continue;
      present.add(key);
      mentions.push(type.create({ label: path.split(/[\\/]/).pop() || path, path, fsPath: path }));
    }
    if (!mentions.length) return true;
    const { state } = controller.view;
    let position = null;
    state.doc.descendants((node, pos) => {
      if (position === null && node.isTextblock && node.type.contentMatch.matchType(type)) position = pos + 1;
      return position === null;
    });
    const transaction = state.tr;
    if (position === null) transaction.insert(state.doc.content.size, state.schema.nodes.paragraph.create(null, mentions));
    else for (const mention of mentions) {
      transaction.insert(position, mention);
      position += mention.nodeSize;
    }
    controller.view.dispatch(transaction);
    ensureTaskAssetComposerChips();
    return true;
  }

  function taskAssetReferenceKey(path) {
    return path.replace(/\\/g, "/").toLowerCase();
  }

  function taskComposerAssetReferences(controller) {
    const entries = [];
    controller?.view.state.doc.descendants((node, pos) => {
      if (node.type.name === "atMention" && isAbsoluteWindowsAssetPath(node.attrs.fsPath || node.attrs.path)) {
        entries.push({ ...node.attrs, pos, nodeSize: node.nodeSize });
      }
    });
    return entries;
  }

  function removeTaskAssetReference(path, threadId) {
    if (normalizedThreadId(currentConversationThreadId()) !== normalizedThreadId(threadId)) return;
    const controller = taskSkillComposerController();
    if (!controller) return;
    const entries = taskComposerAssetReferences(controller).filter((entry) => taskAssetReferenceKey(entry.fsPath || entry.path) === taskAssetReferenceKey(path));
    if (!entries.length) return;
    const transaction = controller.view.state.tr;
    for (const entry of entries.reverse()) transaction.delete(entry.pos, entry.pos + entry.nodeSize);
    controller.view.dispatch(transaction);
    ensureTaskAssetComposerChips();
  }

  function ensureTaskAssetComposerChips() {
    const id = "codex-task-asset-composer-chips";
    const portal = document.querySelector('[data-codex-composer-root][data-composer-placement="thread"] > [data-above-composer-portal="true"]');
    const entries = taskComposerAssetReferences(taskSkillComposerController());
    let container = document.getElementById(id);
    if (!portal || !entries.length) { container?.remove(); return; }
    if (!container || container.parentElement !== portal) {
      container?.remove();
      container = document.createElement("div");
      container.id = id;
      container.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;padding:6px 12px";
      portal.append(container);
    }
    const threadId = currentConversationThreadId();
    const signature = JSON.stringify([threadId, entries.map((entry) => [entry.path, entry.fsPath, entry.label])]);
    if (container.assetSignature === signature) return;
    container.assetSignature = signature;
    container.replaceChildren();
    const style = document.createElement("style");
    style.textContent = entries.map((entry) => `[data-composer-placement="thread"] [contenteditable="true"] [at-mention-path="${CSS.escape(entry.path)}"]`).join(",") + "{display:none!important}";
    container.append(style);
    const unique = new Map(entries.map((entry) => [taskAssetReferenceKey(entry.fsPath || entry.path), entry]));
    for (const entry of unique.values()) {
      const path = entry.fsPath || entry.path;
      const chip = document.createElement("span");
      chip.style.cssText = "display:inline-flex;align-items:center;gap:7px;max-width:100%;border:1px solid var(--border-default,#8885);border-radius:8px;padding:3px 7px;font-size:12px";
      chip.title = path;
      const label = document.createElement("span");
      label.textContent = entry.label || path.split(/[\\/]/).pop();
      label.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `移除文件引用：${label.textContent}`);
      remove.onclick = () => removeTaskAssetReference(path, threadId);
      chip.append(label, remove);
      container.append(chip);
    }
  }

  function addAssetReferenceToComposer(assetPath) {
    return addAssetReferencesToComposer([assetPath]);
  }

  function isAbsoluteWindowsAssetPath(value) {
    const assetPath = typeof value === "string" ? value.trim() : "";
    return /^[A-Za-z]:[\\/][^\0\r\n]*$/.test(assetPath)
      || /^[\\/]{2}[^\\/\0\r\n]+[\\/][^\\/\0\r\n]+(?:[\\/][^\0\r\n]*)?$/.test(assetPath);
  }

  function handleAssetConsoleMessage(event) {
    if (event.origin !== "https://web-sandbox.oaiusercontent.com") return;
    const frame = document.getElementById(ASSET_CONSOLE_FRAME_ID);
    if (!frame || event.source !== frame.contentWindow) return;
    const message = event.data;
    if (!message || message.source !== "asset-console") return;
    const panel = document.getElementById(ASSET_CONSOLE_PANEL_ID);
    if (message.source === "asset-console" && (panel?.hidden || panel?.dataset.taskContextKey !== assetConsoleTaskContextKey())) return;
    if (message.action === "return-to-codex") {
      closeAssetConsolePanel({ focusTarget: "composer" });
      return;
    }
    const single = message.action === "use-in-codex";
    const multiple = message.action === "use-many-in-codex";
    if (!single && !multiple) return;
    const assetPaths = single
      ? [typeof message.path === "string" ? message.path.trim() : ""]
      : Array.isArray(message.paths) ? message.paths.map((path) => typeof path === "string" ? path.trim() : "") : [];
    const validPaths = assetPaths.length > 0
      && assetPaths.length <= 8
      && assetPaths.every((assetPath) => assetPath.length < 4096 && isAbsoluteWindowsAssetPath(assetPath));
    const added = validPaths && addAssetReferencesToComposer(assetPaths);
    try {
      frame.contentWindow.postMessage({
        source: "codex-sidebar-enhancer",
        action: added ? (multiple ? "assets-added" : "asset-added") : "asset-add-failed",
        count: added ? assetPaths.length : 0,
      }, event.origin);
    } catch {}
    if (added) requestAnimationFrame(() => frame.focus());
  }

  function positionAssetConsolePanel() {
    const panel = document.getElementById(ASSET_CONSOLE_PANEL_ID);
    if (!panel || panel.dataset.docked === "true") return;
    const sidebar = document.getElementById(SHORTCUT_GRID_ID)?.closest("aside");
    const rect = sidebar?.getBoundingClientRect();
    panel.style.left = `${Math.max(0, Math.round(rect?.right || 0))}px`;
    panel.style.top = `${Math.max(0, Math.round(rect?.top || 36))}px`;
  }

  function setAssetConsolePanelState(state, message = "") {
    const panel = document.getElementById(ASSET_CONSOLE_PANEL_ID);
    if (!panel) return;
    const label = panel.dataset.consoleKind === "operations" ? "专项运营"
      : panel.dataset.consoleKind === "skill" ? "技能管理" : "资产库";
    panel.dataset.state = state;
    const stateNode = panel.querySelector(".codex-asset-console-state");
    const messageNode = panel.querySelector(".codex-asset-console-message");
    if (stateNode) stateNode.hidden = state === "ready";
    if (messageNode) messageNode.textContent = message
      || (state === "loading" ? `正在连接${label}…` : state === "error" ? `${label}暂时无法加载` : "");
  }

  function handleSkillConsoleMessage(event) {
    if (event.origin !== "https://web-sandbox.oaiusercontent.com") return;
    const frame = document.getElementById(ASSET_CONSOLE_FRAME_ID);
    if (!frame || event.source !== frame.contentWindow || frame.closest(`[data-console-kind="skill"]`) === null) return;
    const message = event.data;
    if (!message || message.source !== "skill-console") return;
    if (message.action === "skill-detail-open") {
      document.getElementById(MAIN_CONSOLE_HOST_ID)?.setAttribute("data-skill-detail-open", "true");
      const frameRect = frame.getBoundingClientRect();
      const sourceWidth = Number(message.rect?.viewportWidth) || frame.clientWidth || frameRect.width;
      const sourceHeight = Number(message.rect?.viewportHeight) || frame.clientHeight || frameRect.height;
      const scaleX = frameRect.width / Math.max(1, sourceWidth);
      const scaleY = frameRect.height / Math.max(1, sourceHeight);
      const rect = message.rect && {
        x: frameRect.left + Number(message.rect.x || 0) * scaleX,
        y: frameRect.top + Number(message.rect.y || 0) * scaleY,
        width: Number(message.rect.width || 0) * scaleX,
        height: Number(message.rect.height || 0) * scaleY,
      };
      setWorkspaceModalDim(true, rect);
      return;
    }
    if (message.action === "skill-detail-close") {
      document.getElementById(MAIN_CONSOLE_HOST_ID)?.removeAttribute("data-skill-detail-open");
      setWorkspaceModalDim(false);
      return;
    }
    if (message.action === "open-plugin") {
      setWorkspaceModalDim(false);
      closeAssetConsolePanel({ notify: true, focusTarget: "none", destroy: true });
      requestAnimationFrame(() => findNativeShortcutButton("插件")?.click());
    }
  }

  function setWorkspaceModalDim(active, rect = null) {
    let overlay = document.getElementById(WORKSPACE_DIM_OVERLAY_ID);
    if (!active) {
      overlay?.remove();
      document.getElementById(MAIN_CONSOLE_HOST_ID)?.removeAttribute("data-skill-detail-open");
      return;
    }
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = WORKSPACE_DIM_OVERLAY_ID;
      overlay.dataset.codexPreviewRuntime = RUNTIME_TOKEN;
      overlay.setAttribute("aria-hidden", "true");
      const closeDetail = () => {
        const frame = document.getElementById(ASSET_CONSOLE_FRAME_ID);
        try {
          frame?.contentWindow?.postMessage({
            source: "codex-sidebar-enhancer",
            type: "close-skill-detail",
          }, "https://web-sandbox.oaiusercontent.com");
        } catch {}
      };
      ["top", "right", "bottom", "left"].forEach((side) => {
        const segment = document.createElement("span");
        segment.className = `codex-modal-dim-segment codex-modal-dim-${side}`;
        segment.addEventListener("click", closeDetail);
        overlay.appendChild(segment);
      });
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closeDetail();
      });
      document.body.appendChild(overlay);
    }
    const host = document.getElementById(MAIN_CONSOLE_HOST_ID);
    const hostRect = host?.getBoundingClientRect();
    if (hostRect && hostRect.width > 0 && hostRect.height > 0) {
      overlay.style.setProperty("--host-x", `${Math.max(0, hostRect.x)}px`);
      overlay.style.setProperty("--host-y", `${Math.max(0, hostRect.y)}px`);
      overlay.style.setProperty("--host-w", `${Math.max(1, hostRect.width)}px`);
      overlay.style.setProperty("--host-h", `${Math.max(1, hostRect.height)}px`);
    }
    overlay.hidden = false;
  }

  function formatCardUpdatedAt(timestamp, now = Date.now()) {
    if (!Number.isFinite(timestamp)) return "时间未提供";
    const date = new Date(timestamp);
    const current = new Date(now);
    const elapsed = Math.max(0, now - timestamp);
    if (elapsed < 60_000) return "刚刚更新";
    if (elapsed < 60 * 60_000) return `更新 ${Math.floor(elapsed / 60_000)} 分钟前`;
    const sameDay = date.getFullYear() === current.getFullYear()
      && date.getMonth() === current.getMonth()
      && date.getDate() === current.getDate();
    const clock = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    if (sameDay) return `更新 ${clock}`;
    const yesterday = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 1);
    if (date.getFullYear() === yesterday.getFullYear()
      && date.getMonth() === yesterday.getMonth()
      && date.getDate() === yesterday.getDate()) return `更新 昨天 ${clock}`;
    return `更新 ${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function mainConsoleHost() {
    let host = document.getElementById(MAIN_CONSOLE_HOST_ID);
    if (host?.dataset.codexPreviewRuntime !== RUNTIME_TOKEN) {
      host?.remove();
      host = null;
    }
    if (host) return host;
    const layout = document.querySelector('[data-app-shell-main-content-layout="thread-edge-scroll"]')
      || document.querySelector('[data-app-shell-main-content-viewport]')
      || document.querySelector("main")
      || document.querySelector("#root");
    if (!layout) return null;
    const parent = layout;
    if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
    host = document.createElement("div");
    host.id = MAIN_CONSOLE_HOST_ID;
    host.dataset.codexPreviewRuntime = RUNTIME_TOKEN;
    host.setAttribute("aria-label", "Codex 工作区");
    // Capture the already-painted Codex surface before the host is inserted.
    // The host covers the native main view while an embedded frame is warming
    // up; inheriting a real surface color prevents a transparent/Canvas
    // fallback from producing a black flash during that handoff.
    const surfaceNode = parent.matches?.("main") ? parent : document.querySelector("main") || parent;
    const surface = getComputedStyle(surfaceNode).backgroundColor;
    const bodySurface = getComputedStyle(document.body).backgroundColor;
    const resolvedSurface = surface && !/^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/i.test(surface)
      ? surface : bodySurface;
    if (resolvedSurface) {
      host.style.setProperty("--codex-console-surface", resolvedSurface);
      host.style.backgroundColor = resolvedSurface;
    }
    parent.appendChild(host);
    return host;
  }

  function syncCustomWorkspaceMode() {
    const panel = document.getElementById(ASSET_CONSOLE_PANEL_ID);
    const active = Boolean(panel && !panel.hidden && panel.closest(`#${MAIN_CONSOLE_HOST_ID}`));
    document.documentElement.setAttribute(CUSTOM_WORKSPACE_ATTR, String(active));
  }

  function syncEmbeddedConsoleTheme() {
    const frame = document.getElementById(ASSET_CONSOLE_FRAME_ID);
    if (!frame?.contentWindow) return;
    const dark = document.documentElement.classList.contains("electron-dark")
      || document.documentElement.dataset.theme === "dark"
      || matchMedia("(prefers-color-scheme: dark)").matches;
    try {
      frame.contentWindow.postMessage({
        source: "codex-sidebar-enhancer",
        type: "theme-change",
        theme: dark ? "dark" : "light",
        surface: getComputedStyle(document.querySelector("main") || document.body).backgroundColor,
      }, "https://web-sandbox.oaiusercontent.com");
    } catch {}
  }

  function resetOperationsFrameChannel({ preserveWorkstream = true } = {}) {
    operationsFrameReady = false;
    operationsFrameNonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    operationsPendingMessage = null;
    if (!preserveWorkstream) companyOperationsWorkstream = "";
    if (companyOperationsWorkstream) {
      operationsPendingMessage = {
        source: "codex-sidebar-enhancer",
        action: "open-workstream",
        workstream: companyOperationsWorkstream,
        nonce: operationsFrameNonce,
      };
    }
  }

  function sendOperationsWorkstream(workstream) {
    if (!COMPANY_OPERATIONS_WORKSTREAMS.has(workstream)) return false;
    companyOperationsWorkstream = workstream;
    const panel = document.querySelector(`#${ASSET_CONSOLE_PANEL_ID}[data-console-kind="operations"]`);
    if (panel) panel.dataset.workstream = workstream;
    document.querySelectorAll("[data-codex-company-workstream]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.codexCompanyWorkstream === workstream));
    });
    if (!operationsFrameNonce) resetOperationsFrameChannel();
    const message = {
      source: "codex-sidebar-enhancer",
      action: "open-workstream",
      workstream,
      nonce: operationsFrameNonce,
    };
    const frame = document.getElementById(ASSET_CONSOLE_FRAME_ID);
    if (!operationsFrameReady || !frame?.contentWindow) {
      operationsPendingMessage = message;
      return true;
    }
    try {
      frame.contentWindow.postMessage(message, "https://web-sandbox.oaiusercontent.com");
      operationsPendingMessage = null;
      return true;
    } catch {
      operationsPendingMessage = message;
      return false;
    }
  }

  function flushOperationsFrameMessage() {
    operationsFrameReady = true;
    const message = operationsPendingMessage;
    if (!message || message.nonce !== operationsFrameNonce) return;
    sendOperationsWorkstream(message.workstream);
  }

  function setAssetConsolePanel(value) {
    const source = value && typeof value === "object" ? value : {};
    const panel = document.getElementById(ASSET_CONSOLE_PANEL_ID);
    if (!panel) return;
    const panelKind = ["asset", "skill", "operations"].includes(panel.dataset.consoleKind)
      ? panel.dataset.consoleKind : "asset";
    if (source.panel && source.panel !== panelKind) return;
    if (source.state !== "ready" || typeof source.url !== "string" || !source.url) {
      panel.querySelector(`#${ASSET_CONSOLE_FRAME_ID}`)?.remove();
      if (panelKind === "operations") resetOperationsFrameChannel();
      setAssetConsolePanelState(source.state === "error" ? "error" : "loading", source.message || "");
      panel.closest(`#${MAIN_CONSOLE_HOST_ID}`)?.removeAttribute("data-console-switching");
      return;
    }
    const body = panel.querySelector(".codex-asset-console-body");
    if (!body) return;
    let frame = document.getElementById(ASSET_CONSOLE_FRAME_ID);
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = ASSET_CONSOLE_FRAME_ID;
      frame.title = source.label || (panelKind === "operations" ? "专项运营"
        : panelKind === "skill" ? "技能管理" : "资产库");
      frame.setAttribute("allow", "clipboard-read; clipboard-write; autoplay");
      frame.onload = () => {
        // Appending an iframe fires an initial about:blank load. It is not the
        // embedded console and must not release the handoff cover or mark the
        // panel ready before the requested URL has painted.
        const expectedUrl = frame.dataset.codexExpectedUrl || "";
        if (!expectedUrl || frame.src !== expectedUrl) return;
        setAssetConsolePanelState("ready");
        syncEmbeddedConsoleTheme();
        panel.closest(`#${MAIN_CONSOLE_HOST_ID}`)?.removeAttribute("data-console-switching");
        if (panelKind === "operations") flushOperationsFrameMessage();
      };
      frame.onerror = () => {
        setAssetConsolePanelState("error", "内嵌页面加载失败，请重试");
        panel.closest(`#${MAIN_CONSOLE_HOST_ID}`)?.removeAttribute("data-console-switching");
      };
      body.appendChild(frame);
    }
    setAssetConsolePanelState(frame.src === source.url && (panelKind !== "operations" || operationsFrameReady) ? "ready" : "loading");
    if (frame.src !== source.url) {
      frame.dataset.codexExpectedUrl = source.url;
      frame.src = source.url;
    } else if (frame.src === source.url) {
      frame.dataset.codexExpectedUrl = source.url;
    }
  }

  function closeAssetConsolePanel({ notify = true, focusTarget = "opener", destroy = false, preserveHost = false } = {}) {
    const panel = document.getElementById(ASSET_CONSOLE_PANEL_ID);
    if (!panel) return;
    if (panel.dataset.consoleKind === "operations" && panel.dataset.docked === "true" && !destroy
      && document.documentElement.getAttribute(COMPANY_WORKBENCH_MODE_ATTR) === "true") {
      requestAnimationFrame(() => {
        const target = focusTarget === "composer" ? currentComposer() : assetConsoleReturnFocus;
        if (target instanceof HTMLElement && target.isConnected) target.focus();
      });
      return;
    }
    const panelKind = ["asset", "skill", "operations"].includes(panel.dataset.consoleKind)
      ? panel.dataset.consoleKind : "asset";
    if (panelKind === "skill") setWorkspaceModalDim(false);
    const returnFocus = assetConsoleReturnFocus;
    const keepAsset = ["asset", "skill"].includes(panelKind)
      && isTaskShell() && !destroy && Boolean(panel.closest("[data-task-asset-console-host]"));
    if (keepAsset) {
      panel.hidden = true;
      if (panel.closest("[data-task-asset-console-host]")) taskRailTab = "context";
    }
    else panel.remove();
    if (!keepAsset && !preserveHost) document.getElementById(MAIN_CONSOLE_HOST_ID)?.remove();
    if (panelKind === "operations") resetOperationsFrameChannel({ preserveWorkstream: false });
    assetConsoleReturnFocus = null;
    syncCustomWorkspaceMode();
    if (notify && !keepAsset) notifyAssetConsole("close", panelKind);
    scheduleSync();
    requestAnimationFrame(() => {
      const target = focusTarget === "none" ? null : focusTarget === "composer" ? currentComposer() : returnFocus;
      if (target instanceof HTMLElement && target.isConnected) target.focus();
    });
  }

  function syncAssetConsoleTaskContext({ force = false } = {}) {
    const panel = document.getElementById(ASSET_CONSOLE_PANEL_ID);
    if (!panel || panel.hidden) return false;
    const context = currentCodexTaskContext();
    if (!context.threadId) return false;
    const nextKey = assetConsoleTaskContextKey(context);
    if (!force && panel.dataset.taskContextKey === nextKey) return false;
    panel.dataset.taskContextKey = nextKey;
    panel.querySelector(`#${ASSET_CONSOLE_FRAME_ID}`)?.remove();
    if (panel.dataset.consoleKind === "operations") resetOperationsFrameChannel();
    setAssetConsolePanelState("loading");
    if (!notifyAssetConsole("open", panel.dataset.consoleKind)) {
      setAssetConsolePanelState("error", "本机连接未就绪，请稍后重试");
    }
    return true;
  }

  function openAssetConsolePanel(consoleKind = "asset", options = {}) {
    const kind = ["operations", "skill"].includes(consoleKind) ? consoleKind : "asset";
    const label = kind === "operations" ? "专项运营" : kind === "skill" ? "技能管理" : "资产库";
    const rail = document.getElementById(THREAD_OVERVIEW_RAIL_ID);
    const workspace = options.workspace === true;
    let workspaceHost = workspace ? mainConsoleHost() : null;
    // A sidebar entry opens a full in-app workspace. Only explicitly
    // right-rail requests may use the task asset host; otherwise the next
    // sidebar sync would move the skill workspace into the rail and replace it.
    const assetHost = !workspace && ["asset", "skill"].includes(kind) && isTaskShell()
      ? rail?.querySelector("[data-task-asset-console-host]") : null;
    if (assetHost) {
      taskRailTab = "assets";
      overviewCollapsed = false;
      try { localStorage.setItem(OVERVIEW_COLLAPSED_KEY, "false"); } catch {}
      scheduleSync();
    }
    const docked = options.docked ?? (workspace || kind === "operations"
      && document.documentElement.getAttribute(COMPANY_WORKBENCH_MODE_ATTR) === "true"
      && Boolean(rail));
    const existing = document.getElementById(ASSET_CONSOLE_PANEL_ID);
    if (workspace && (!existing || existing.dataset.consoleKind !== kind)) {
      workspaceHost?.setAttribute("data-console-switching", "true");
    }
    if (existing?.dataset.consoleKind === kind) {
      if (existing.hidden) assetConsoleReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const launcher = rail?.querySelector(".codex-company-ops-launcher");
      if (assetHost) {
        if (existing.parentElement !== assetHost) assetHost.appendChild(existing);
      }
      else if (docked && rail && (existing.parentElement !== rail || existing.nextElementSibling !== launcher)) {
        rail.insertBefore(existing, launcher || null);
      }
      else if (workspaceHost && existing.parentElement !== workspaceHost) workspaceHost.appendChild(existing);
      else if (!docked && existing.parentElement !== document.body) document.body.appendChild(existing);
      existing.dataset.docked = String(docked);
      existing.dataset.workspace = String(workspace);
      existing.hidden = false;
      existing.setAttribute("role", docked ? "region" : "dialog");
      const close = existing.querySelector("[data-codex-asset-console-close]");
      if (close) {
        close.setAttribute("aria-label", assetHost ? "返回上下文" : docked ? "返回主控态势" : `关闭${label}`);
        close.title = assetHost ? "返回上下文" : docked ? "返回主控态势" : "关闭";
      }
      updateAssetConsoleExpandButton(existing, assetHost);
      if (docked) {
        existing.style.removeProperty("left");
        existing.style.removeProperty("top");
      }
      if (kind === "operations" && !operationsFrameReady) {
        const frame = existing.querySelector(`#${ASSET_CONSOLE_FRAME_ID}`);
        if (frame?.src) {
          frame.onload = () => {
            setAssetConsolePanelState("ready");
            flushOperationsFrameMessage();
          };
          setAssetConsolePanelState("loading");
          frame.src = frame.src;
        }
      }
      positionAssetConsolePanel();
      syncAssetConsoleTaskContext();
      syncCustomWorkspaceMode();
      return;
    }
    if (existing) {
      if (workspaceHost) workspaceHost.setAttribute("data-console-switching", "true");
      closeAssetConsolePanel({ notify: false, focusTarget: "none", destroy: true, preserveHost: workspace });
      if (workspace) workspaceHost = mainConsoleHost();
    }
    assetConsoleReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = document.createElement("section");
    panel.id = ASSET_CONSOLE_PANEL_ID;
    panel.dataset.state = "loading";
    panel.dataset.consoleKind = kind;
    panel.dataset.docked = String(docked);
    panel.dataset.workspace = String(workspace);
    panel.dataset.taskContextKey = assetConsoleTaskContextKey();
    panel.setAttribute("role", docked ? "region" : "dialog");
    panel.setAttribute("aria-label", label);
    panel.innerHTML = `
      <header class="codex-asset-console-header">
        <span class="codex-asset-console-title">${label}</span>
        <span class="codex-asset-console-local">本机直连</span>
        <span class="codex-asset-console-spacer"></span>
        <button type="button" class="codex-asset-console-action" data-codex-asset-console-expand hidden></button>
        <button type="button" class="codex-asset-console-action" data-codex-asset-console-refresh aria-label="刷新${label}" title="刷新">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M12.7 5.2A5.4 5.4 0 1 0 13 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M10.2 5.2h2.8V2.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button type="button" class="codex-asset-console-action" data-codex-asset-console-close aria-label="关闭${label}" title="关闭">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>
        </button>
      </header>
      <div class="codex-asset-console-body">
        <div class="codex-asset-console-state" role="status">
          <span class="codex-asset-console-spinner" aria-hidden="true"></span>
          <span class="codex-asset-console-message">正在连接${label}…</span>
          <button type="button" class="codex-asset-console-retry">重新连接</button>
        </div>
      </div>`;
    const closeButton = panel.querySelector("[data-codex-asset-console-close]");
    closeButton.setAttribute("aria-label", assetHost ? "返回上下文" : docked ? "返回主控态势" : `关闭${label}`);
    closeButton.title = assetHost ? "返回上下文" : docked ? "返回主控态势" : "关闭";
    if (docked && kind === "operations") closeButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m9.5 3.5-4.5 4.5 4.5 4.5M5 8h7" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    updateAssetConsoleExpandButton(panel, assetHost);
    panel.querySelector("[data-codex-asset-console-expand]").onclick = () => openAssetConsolePanel("asset", { docked: panel.dataset.docked !== "true" });
    closeButton.onclick = () => {
      if (panel.dataset.docked === "true" && panel.dataset.consoleKind === "operations") returnToCompanyMaster();
      else closeAssetConsolePanel();
    };
    panel.querySelector("[data-codex-asset-console-refresh]").onclick = () => {
      const frame = document.getElementById(ASSET_CONSOLE_FRAME_ID);
      if (frame) {
        if (kind === "operations") resetOperationsFrameChannel();
        frame.src = frame.src;
      }
      else {
        if (kind === "operations") resetOperationsFrameChannel();
        setAssetConsolePanelState("loading");
        notifyAssetConsole("open", kind);
      }
    };
    panel.querySelector(".codex-asset-console-retry").onclick = () => {
      if (kind === "operations") resetOperationsFrameChannel();
      setAssetConsolePanelState("loading");
      notifyAssetConsole("open", kind);
    };
    if (workspaceHost) workspaceHost.appendChild(panel);
    else if (assetHost) assetHost.appendChild(panel);
    else if (docked && rail) rail.insertBefore(panel, rail.querySelector(".codex-company-ops-launcher"));
    else document.body.appendChild(panel);
    syncCustomWorkspaceMode();
    positionAssetConsolePanel();
    scheduleSync();
    if (!notifyAssetConsole("open", kind)) {
      setAssetConsolePanelState("error", "本机连接未就绪，请稍后重试");
    }
  }

  function updateAssetConsoleExpandButton(panel, assetHost) {
    const button = panel.querySelector("[data-codex-asset-console-expand]");
    if (!button) return;
    button.hidden = !assetHost;
    const docked = panel.dataset.docked === "true";
    const label = docked ? "展开资产工作区" : "收回右栏";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.textContent = docked ? "↗" : "↙";
  }

  function syncTaskAssetPanel(rail) {
    const host = rail.querySelector("[data-task-asset-console-host]");
    const panel = host?.querySelector(`#${ASSET_CONSOLE_PANEL_ID}`);
    const visible = isTaskShell() && taskRailTab === "assets" && !overviewCollapsed;
    if (!visible) {
      if (panel) panel.hidden = true;
      return;
    }
    if (!panel || panel.hidden) {
      // Preserve whichever inline console the user opened. Asset is the
      // default when the task has not opened a console yet.
      openAssetConsolePanel(panel?.dataset.consoleKind === "skill" ? "skill" : "asset", { docked: true });
    }
    else syncAssetConsoleTaskContext();
  }

  function handleAssetConsoleKeydown(event) {
    const panel = document.getElementById(ASSET_CONSOLE_PANEL_ID);
    if (event.key === "Escape" && panel && !panel.hidden) {
      event.preventDefault();
      if (panel.dataset.docked === "true" && panel.dataset.consoleKind === "operations") returnToCompanyMaster();
      else closeAssetConsolePanel();
    }
  }

  function nativeShortcutSources() {
    const newConversation = findNativeShortcutButton("新对话");
    const pullRequests = findNativeShortcutButton("拉取请求");
    const site = findNativeShortcutButton("站点");
    const scheduled = findNativeShortcutButton("已安排");
    const plugins = findNativeShortcutButton("插件");
    const navigationGroup = (pullRequests || site || scheduled || plugins)?.parentElement;
    const newConversationRow = newConversation?.parentElement;
    const header = document.querySelector("[data-app-action-sidebar-scroll]")
      || newConversationRow?.closest("nav");
    if (!newConversation || !navigationGroup || !header) return null;

    const quickButton = Array.from(newConversationRow.children)
      .flatMap((node) => node === newConversation ? [] : Array.from(node.querySelectorAll?.("button") || []))[0] || null;
    const project = nativeSectionSource("项目")?.button || null;
    const search = Array.from(document.querySelectorAll("button")).find((button) =>
      /^(搜索|Search)$/iu.test(button.getAttribute("aria-label") || button.getAttribute("title") || ""),
    ) || null;
    const projectAction = () => {
      const tab = document.querySelector(`#${SECTION_TABS_ID} [data-codex-sidebar-section-tab="项目"]`);
      if (tab) tab.click();
      else project?.click();
    };
    const skillsAction = () => {
      if (isTaskShell() && innerWidth > 1100 && document.getElementById(THREAD_OVERVIEW_RAIL_ID)) {
        taskRailTab = "skills";
        overviewCollapsed = false;
        try { localStorage.setItem(OVERVIEW_COLLAPSED_KEY, "false"); } catch {}
        ensureThreadOverviewRail();
        return;
      }
      plugins?.click();
      const startedAt = Date.now();
      const openSkillsTab = () => {
        if (destroyed) return;
        const visibleTabs = Array.from(document.querySelectorAll("button")).filter((button) =>
          !button.closest(`#${SHORTCUT_GRID_ID}`)
          && button.getBoundingClientRect().width > 0
          && button.getBoundingClientRect().height > 0
          && button.hasAttribute("aria-pressed"),
        );
        const pluginsTab = visibleTabs.find((button) => button.textContent?.trim() === "插件");
        const skillsTab = visibleTabs.find((button) => button.textContent?.trim() === "技能");
        if (pluginsTab?.getAttribute("aria-pressed") === "true" && skillsTab) {
          skillsTab.click();
          scheduleSync();
          return;
        }
        if (Date.now() - startedAt < 3_000) setTimeout(openSkillsTab, 50);
      };
      setTimeout(openSkillsTab, 50);
    };
    const shortcutConsoleKind = assetConsole.label === "专项运营" && assetConsole.operationsAvailable
      ? "operations"
      : !assetConsole.assetAvailable && assetConsole.operationsAvailable
      ? "operations"
      : "asset";
    const assetConsoleItem = (assetConsole.assetAvailable || assetConsole.operationsAvailable) ? {
      name: shortcutConsoleKind === "operations" ? "专项运营" : assetConsole.label || "资产库",
      button: null,
      quickButton: null,
      activate: () => {
        if (shortcutConsoleKind === "operations"
          && document.documentElement.getAttribute(COMPANY_WORKBENCH_MODE_ATTR) === "true") {
          focusCompanyOperations();
        } else {
          openAssetConsolePanel(shortcutConsoleKind, { workspace: true, docked: true });
        }
      },
      panelKind: shortcutConsoleKind,
      customStatus: true,
    } : null;
    const items = [
      { name: "新对话", button: newConversation, quickButton },
      pullRequests ? { name: "拉取请求", button: pullRequests, quickButton: null } : null,
      scheduled ? { name: "已安排", button: scheduled, quickButton: null } : null,
      plugins ? { name: "Skill 管理", button: plugins, quickButton: null, activate: skillsAction } : null,
      project ? { name: "项目管理", button: project, quickButton: null, activate: projectAction } : null,
      assetConsoleItem || (search ? { name: "搜索", button: search, quickButton: null } : null),
    ].filter(Boolean).filter((item, index, values) =>
      item.name && values.findIndex((candidate) => candidate.name === item.name) === index,
    ).slice(0, 7);
    let navigationContainer = navigationGroup;
    while (navigationContainer.parentElement && navigationContainer.parentElement !== header) {
      navigationContainer = navigationContainer.parentElement;
    }
    return { header, newConversationRow, navigationGroup, navigationContainer, items };
  }

  function ensureSidebarControlsHost(scroll) {
    const navigation = scroll?.parentElement;
    if (!scroll || !navigation) return null;
    let host = document.getElementById(SIDEBAR_CONTROLS_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = SIDEBAR_CONTROLS_ID;
      host.dataset.codexPreviewRuntime = RUNTIME_TOKEN;
      host.setAttribute("aria-label", "侧栏固定控件");
    }
    if (host.parentElement !== navigation || host.nextElementSibling !== scroll) {
      navigation.insertBefore(host, scroll);
    }
    const nativeHeader = host.previousElementSibling;
    if (nativeHeader && nativeHeader !== host) {
      nativeHeader.setAttribute(SIDEBAR_NATIVE_HEADER_STABLE_ATTR, "true");
    }
    const scrollbarWidth = Math.max(0, scroll.offsetWidth - scroll.clientWidth);
    host.style.setProperty("--codex-sidebar-scrollbar-width", `${scrollbarWidth}px`);
    if (host.__codexSidebarScroll !== scroll) {
      if (host.__codexSidebarWheelHandler) {
        host.removeEventListener("wheel", host.__codexSidebarWheelHandler);
      }
      const forwardWheel = (event) => {
        if (event.ctrlKey || event.metaKey || !event.deltaY) return;
        const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? scroll.clientHeight : 1;
        const before = scroll.scrollTop;
        scroll.scrollTop += event.deltaY * unit;
        if (scroll.scrollTop !== before) event.preventDefault();
      };
      host.addEventListener("wheel", forwardWheel, { passive: false });
      host.__codexSidebarScroll = scroll;
      host.__codexSidebarWheelHandler = forwardWheel;
    }
    return host;
  }

  function removeSidebarControlsHostIfEmpty() {
    const host = document.getElementById(SIDEBAR_CONTROLS_ID);
    if (host && !host.children.length) host.remove();
  }

  function handleCustomWorkspaceNavigation(event) {
    const panel = document.getElementById(ASSET_CONSOLE_PANEL_ID);
    if (!panel || panel.hidden || !panel.closest(`#${MAIN_CONSOLE_HOST_ID}`)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(`#${ASSET_CONSOLE_PANEL_ID}`)) return;
    if (target.closest("[data-codex-local-console-entry]")) return;
    const action = target.closest("button, a, [role='button']");
    if (!action || !action.closest(".app-shell-left-panel")) return;
    // Let the native click finish before tearing down the embedded workspace.
    // Removing it during capture can detach the target before React receives
    // the click, which makes navigation appear intermittently unresponsive.
    queueMicrotask(() => {
      if (destroyed) return;
      closeAssetConsolePanel({ notify: true, focusTarget: "none", destroy: true });
    });
  }

  function localConsoleNavIcon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16"); svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 16 16"); svg.setAttribute("fill", "none");
    svg.setAttribute("class", "icon-xs"); svg.setAttribute("aria-hidden", "true");
      const paths = name === "技能"
      ? ['M3 3.5h4v4H3z', 'M11 3.5h4v4h-4z', 'M7 11.5h4v4H7z', 'M7 5.5h4', 'M13 7.5v4']
      : ['M2.25 4.25h11.5v8.5H2.25z', 'M4 2.25h8v2H4z', 'M5 7.25h6'];
    for (const d of paths) { const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); path.setAttribute("d", d); path.setAttribute("fill", "none"); path.setAttribute("stroke", "currentColor"); path.setAttribute("stroke-width", "1.1"); path.setAttribute("stroke-linecap", "round"); path.setAttribute("stroke-linejoin", "round"); svg.appendChild(path); }
    return svg;
  }

  function syncLocalConsoleRowVisual(button, active) {
    button.classList.remove("bg-token-list-hover-background", "bg-token-main-surface-secondary");
    button.classList.toggle("hover:bg-token-list-hover-background", !active);
    const inner = button.querySelector(":scope > div");
    if (inner) { inner.classList.toggle("text-token-list-active-selection-foreground", active); inner.classList.toggle("text-token-foreground", !active); }
    const icon = button.querySelector("svg");
    if (icon) icon.classList.toggle("text-token-list-active-selection-icon-foreground", active);
    if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
  }

  function clearNativeShortcutSelection(except = null) {
    const labels = new Set(["新对话", "已安排", "拉取请求", "站点", "插件", "技能", "组合技", "资产库", "项目", "搜索"]);
    for (const button of document.querySelectorAll("button")) {
      const label = button.querySelector(".text-fade-truncate")?.textContent?.trim() || button.textContent?.trim();
      if (!labels.has(label) || button === except || button.closest(`[data-codex-local-console-entry]`)) continue;
      button.removeAttribute("aria-current");
      button.removeAttribute("data-active");
      button.classList.remove(
        "bg-token-list-hover-background",
        "bg-token-main-surface-secondary",
        "text-token-list-active-selection-foreground",
        "text-token-list-active-selection-icon-foreground",
      );
    }
  }

  function handleTopLevelNavigationSelection(event) {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest("button");
    if (!button || button.closest(`[data-codex-local-console-entry]`)) return;
    if (!button.closest(".app-shell-left-panel")) return;
    const label = button.querySelector(".text-fade-truncate")?.textContent?.trim() || button.textContent?.trim();
    if (!["新对话", "已安排", "拉取请求", "站点", "插件", "项目", "搜索"].includes(label)) return;
    // React owns the native selection state. Defer visual cleanup until after
    // its click handler has committed the new route.
    queueMicrotask(() => {
      if (destroyed) return;
      clearNativeShortcutSelection(button);
      document.querySelectorAll("[data-codex-local-console-entry]").forEach((entry) => {
        entry.removeAttribute("aria-current");
        entry.classList.remove("bg-token-list-hover-background", "bg-token-main-surface-secondary");
        entry.querySelector(":scope > div")?.classList.remove("text-token-list-active-selection-foreground");
        entry.querySelector("svg")?.classList.remove("text-token-list-active-selection-icon-foreground");
      });
    });
  }

  function enforceExclusiveNavigationSelection() {
    const localEntries = [...document.querySelectorAll("[data-codex-local-console-entry]")];
    const panel = document.getElementById(ASSET_CONSOLE_PANEL_ID);
    const panelKind = panel && !panel.hidden ? panel.dataset.consoleKind : "";
    const nativeLabels = new Set(["新建任务", "已安排", "拉取请求", "站点", "插件", "项目", "搜索"]);
    const nativeButtons = [...document.querySelectorAll("button")].filter((button) => {
      if (button.closest("[data-codex-local-console-entry]")) return false;
      const label = button.querySelector(".text-fade-truncate")?.textContent?.trim() || button.textContent?.trim();
      return nativeLabels.has(label);
    });
    if (panelKind === "skill" || panelKind === "asset" || panelKind === "operations") {
      clearNativeShortcutSelection();
    } else {
      const selected = nativeButtons.filter((button) =>
        button.getAttribute("aria-current") === "page"
        || button.getAttribute("data-active") === "true"
        || ["open", "active", "selected"].includes(button.getAttribute("data-state")),
      );
      selected.slice(0, -1).forEach((button) => {
        button.removeAttribute("aria-current");
        button.removeAttribute("data-active");
        button.classList.remove("bg-token-list-hover-background", "bg-token-main-surface-secondary");
      });
    }
    for (const entry of localEntries) {
      const active = Boolean(panelKind && entry.dataset.codexLocalConsoleEntry === panelKind);
      syncLocalConsoleRowVisual(entry, active);
    }
  }

  function ensureLocalConsoleEntries() {
    const plugins = findNativeShortcutButton("插件");
    if (!plugins) { document.querySelectorAll("[data-codex-local-console-entry]").forEach((node) => node.remove()); return; }
    const entries = [];
    if (skillConsole.available) entries.push({ name: "技能", service: "skill" });
    if (assetConsole.assetAvailable || assetConsole.available) entries.push({ name: "资产库", service: "asset" });
    const existing = new Map(Array.from(document.querySelectorAll("[data-codex-local-console-entry]"), (node) => [node.dataset.codexLocalConsoleEntry, node]));
    let previous = plugins;
    const activeKind = document.getElementById(ASSET_CONSOLE_PANEL_ID)?.dataset.consoleKind || "";
    for (const entry of entries) {
      let button = existing.get(entry.service);
      if (button && button.dataset.codexLocalConsoleRuntime !== RUNTIME_TOKEN) {
        button.remove();
        button = null;
      }
      if (!button) {
        button = plugins.cloneNode(true);
        button.dataset.codexLocalConsoleEntry = entry.service;
        button.removeAttribute("id"); button.disabled = false; button.removeAttribute("aria-current");
        button.removeAttribute("data-active");
        button.classList.remove(
          "bg-primary-ghost-hover",
          "bg-token-list-hover-background",
          "bg-token-main-surface-secondary",
          "text-token-list-active-selection-foreground",
          "text-token-list-active-selection-icon-foreground",
        );
        button.setAttribute("aria-label", `打开${entry.name}`); button.title = entry.name;
        button.querySelector(".text-fade-truncate")?.replaceChildren(document.createTextNode(entry.name));
        const iconHost = button.querySelector("div > span.flex.w-4") || button.querySelector("span.flex.w-4");
        if (iconHost) iconHost.replaceChildren(localConsoleNavIcon(entry.name));
        button.dataset.codexLocalConsoleRuntime = RUNTIME_TOKEN;
      }
      // Keep a hot-swapped runtime from leaving the previous "组合技" label
      // on an existing local entry after the sidebar adapter is updated.
      button.setAttribute("aria-label", `打开${entry.name}`);
      button.title = entry.name;
      button.querySelector(".text-fade-truncate")?.replaceChildren(document.createTextNode(entry.name));
      if (button.dataset.codexLocalConsoleBound !== "true") {
        button.onclick = (event) => {
          event.preventDefault(); event.stopPropagation();
          clearNativeShortcutSelection();
          try { openAssetConsolePanel(entry.service, { workspace: true, docked: true }); }
          catch (error) { window.__codexInlineConsoleError = String(error?.stack || error); console.error("Codex inline console open failed", error); }
        };
        button.dataset.codexLocalConsoleBound = "true";
      }
      if (button.previousElementSibling !== previous) previous.after(button);
      previous = button;
      syncLocalConsoleRowVisual(button, activeKind === entry.service);
      }
      existing.forEach((node, service) => { if (!entries.some((entry) => entry.service === service)) node.remove(); });
    // Keep the native Plugins row's selected state intact; the shared sync
    // pass will reconcile it with any active local console panel.
  }

  function shortcutIcon(source, className = SHORTCUT_ICON_CLASS, fallbackName = "") {
    const host = document.createElement("span");
    host.className = className;
    host.setAttribute("aria-hidden", "true");
    const image = source?.querySelector("svg, img")?.cloneNode(true);
    if (fallbackName === "项目管理") {
      host.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3.25 3.25h4.5v4.5h-4.5zM10.25 3.25h4.5v4.5h-4.5zM3.25 10.25h4.5v4.5h-4.5zM10.25 10.25h4.5v4.5h-4.5z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/></svg>`;
    }
    else if (fallbackName === "技能" || fallbackName === "Skill 管理") {
      host.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M4 3.25h7.25L14 6v8.75H4zM11.25 3.25V6H14M6.5 9h5M6.5 11.5h3.25" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/><path d="m6.5 5.15.32.65.72.1-.52.5.12.71-.64-.34-.64.34.12-.71-.52-.5.72-.1z" fill="currentColor"/></svg>`;
    }
    else if (fallbackName === "资产库") {
      host.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 6.25h12v8.25H3zM4.25 3.5h9.5v2.75h-9.5zM6.25 9.25h5.5" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    else if (fallbackName === "专项运营") {
      host.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M4 3.5h10v11H4zM6.5 6.25h5M6.5 9h5M6.5 11.75h3" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/><path d="m12.1 11.7.65.65 1.35-1.55" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    else if (image) host.appendChild(image);
    return host;
  }

  function createShortcutCard(item) {
    const wrap = document.createElement("div");
    wrap.setAttribute("data-codex-sidebar-shortcut-card-wrap", "true");
    const button = document.createElement("button");
    button.type = "button";
    button.className = SHORTCUT_CARD_CLASS;
    button.dataset.codexSidebarShortcutCard = "true";
    button.dataset.codexSidebarShortcutName = item.name;
    const fallbackAriaLabel = /^[A-Za-z]/.test(item.name) ? `打开 ${item.name}` : `打开${item.name}`;
    button.setAttribute("aria-label", item.button?.getAttribute("aria-label") || fallbackAriaLabel);
    button.title = item.name;
    const label = document.createElement("span");
    label.className = SHORTCUT_LABEL_CLASS;
    label.textContent = item.name;
    button.append(shortcutIcon(item.button, SHORTCUT_ICON_CLASS, item.name), label);
    button.onclick = () => {
      if (!item.panelKind) closeAssetConsolePanel();
      if (item.activate) item.activate();
      else item.button?.click();
    };
    wrap.appendChild(button);

    if (item.quickButton) {
      const quick = document.createElement("button");
      quick.type = "button";
      quick.dataset.codexSidebarShortcutQuick = "true";
      quick.setAttribute("aria-label", item.quickButton.getAttribute("aria-label") || "快速聊天");
      quick.title = item.quickButton.getAttribute("aria-label") || "快速聊天";
      const image = item.quickButton.querySelector("svg, img")?.cloneNode(true);
      if (image) quick.appendChild(image);
      quick.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        item.quickButton.click();
      };
      wrap.appendChild(quick);
    }
    return wrap;
  }

  function updateShortcutCard(grid, item) {
    const button = Array.from(grid.querySelectorAll("[data-codex-sidebar-shortcut-card]"))
      .find((candidate) => candidate.dataset.codexSidebarShortcutName === item.name);
    if (!button) return;
    button.disabled = item.button?.disabled === true;
    const state = item.button?.getAttribute("data-state");
    const panel = document.getElementById(ASSET_CONSOLE_PANEL_ID);
    const active = (item.panelKind && !panel?.hidden && panel?.dataset.consoleKind === item.panelKind)
      || item.button?.getAttribute("aria-current") === "page"
      || item.button?.getAttribute("data-active") === "true"
      || state === "open" || state === "active" || state === "selected";
    button.dataset.active = String(active);
    const fallbackAriaLabel = /^[A-Za-z]/.test(item.name) ? `打开 ${item.name}` : `打开${item.name}`;
    button.setAttribute("aria-label", item.button?.getAttribute("aria-label") || fallbackAriaLabel);
    const wrap = button.closest("[data-codex-sidebar-shortcut-card-wrap]");
    const hasStatus = item.customStatus || (item.name !== "项目管理" && item.button?.children.length > 1);
    let status = wrap?.querySelector(".codex-sidebar-shortcut-status");
    if (hasStatus && !status) {
      status = document.createElement("span");
      status.className = "codex-sidebar-shortcut-status";
      status.setAttribute("aria-hidden", "true");
      wrap.appendChild(status);
    } else if (!hasStatus) {
      status?.remove();
    }
  }

  function nativeProjectNavigationSource() {
    const button = Array.from(document.querySelectorAll("button")).find((candidate) => {
      if (candidate.closest(`#${PROJECT_MANAGER_ID}`) || candidate.closest("main")) return false;
      return candidate.querySelector(".text-fade-truncate")?.textContent?.trim() === "项目";
    });
    if (!button?.parentElement) return null;
    return { button, row: button.parentElement };
  }

  function captureNativeProjectRows() {
    const rows = Array.from(document.querySelectorAll("[data-project-row]"));
    if (!rows.length) return;
    const next = rows.map((row) => {
      const name = row.querySelector(".block.min-w-0.truncate")?.textContent?.trim()
        || row.querySelector("[aria-label^='显示 ']")?.getAttribute("aria-label")?.replace(/^显示\s*/u, "").trim();
      return name ? { id: name, name } : null;
    }).filter(Boolean);
    if (!next.length) return;
    const signature = JSON.stringify(next);
    if (signature === JSON.stringify(nativeProjectCache)) return;
    nativeProjectCache = next;
    try { localStorage.setItem(PROJECT_CACHE_KEY, signature); } catch {}
  }

  function sidebarProjectRecords() {
    const records = new Map();
    const ensure = (id, name) => {
      const projectId = String(id || name || "").trim();
      const projectName = String(name || id || "").trim();
      if (!projectId || !projectName) return null;
      if (!records.has(projectId)) records.set(projectId, {
        id: projectId,
        name: projectName,
        tasks: [],
        activeTaskCount: 0,
        pinned: false,
      });
      return records.get(projectId);
    };
    for (const project of nativeProjectCache) ensure(project?.id, project?.name);
    for (const project of Array.isArray(homeProjects.projects) ? homeProjects.projects : []) {
      ensure(project?.id, project?.name);
    }
    for (const entry of Array.isArray(searchCatalog) ? searchCatalog : []) {
      const record = ensure(entry?.projectId, entry?.projectName);
      if (!record || !entry?.threadId) continue;
      record.tasks.push({
        threadId: entry.threadId,
        title: entry.title || "未命名任务",
        updatedAt: entry.updatedAt || "",
      });
    }
    for (const card of Array.isArray(homeProjects.cards) ? homeProjects.cards : []) {
      const record = ensure(card?.projectId, card?.projectName);
      if (!record) continue;
      record.activeTaskCount = Math.max(record.activeTaskCount, Number(card.activeTaskCount) || 0);
      record.pinned = record.pinned || card.pinned === true;
      if (card.threadId && !record.tasks.some((task) => task.threadId === card.threadId)) {
        record.tasks.push({ threadId: card.threadId, title: card.taskTitle || "未命名任务", updatedAt: card.updatedAt || "" });
      }
    }
    return [...records.values()]
      .map((record) => ({
        ...record,
        tasks: record.tasks.sort((left, right) => Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || "")),
      }))
      .sort((left, right) => Number(right.pinned) - Number(left.pinned)
        || left.name.localeCompare(right.name, "zh-CN"));
  }

  const PROJECT_ICON_DEFINITIONS = {
    folder: { label: "文件夹", body: '<path d="M2.2 4.2h4l1.35 1.5h6.25v6.1a1.8 1.8 0 0 1-1.8 1.8H4a1.8 1.8 0 0 1-1.8-1.8V4.2Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/><path d="M2.5 6.25h11" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>' },
    film: { label: "影视", body: '<rect x="2" y="3" width="12" height="10" rx="1.6" stroke="currentColor" stroke-width="1.25"/><path d="M5 3v10M11 3v10M2 6h3m6 0h3M2 10h3m6 0h3" stroke="currentColor" stroke-width="1.05"/>' },
    image: { label: "图片", body: '<rect x="2.25" y="2.75" width="11.5" height="10.5" rx="1.7" stroke="currentColor" stroke-width="1.25"/><circle cx="5.3" cy="6" r="1.1" stroke="currentColor" stroke-width="1.1"/><path d="m3.4 11 2.7-2.7 1.8 1.8 1.5-1.5 3.2 3.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>' },
    globe: { label: "网页", body: '<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.25"/><path d="M2.4 8h11.2M8 2c1.55 1.65 2.35 3.65 2.35 6S9.55 12.35 8 14C6.45 12.35 5.65 10.35 5.65 8S6.45 3.65 8 2Z" stroke="currentColor" stroke-width="1.05"/>' },
    music: { label: "音频", body: '<path d="M6.5 11.25V4.4l6-1.4v6.75" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="4.75" cy="11.5" rx="1.75" ry="1.35" stroke="currentColor" stroke-width="1.2"/><ellipse cx="10.75" cy="10" rx="1.75" ry="1.35" stroke="currentColor" stroke-width="1.2"/>' },
    file: { label: "文档", body: '<path d="M4 2.2h5l3 3v8.6H4V2.2Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/><path d="M9 2.5v3h3M6 8h4M6 10.5h4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>' },
    code: { label: "代码", body: '<path d="m5.7 4-4 4 4 4M10.3 4l4 4-4 4M9 2.8 7 13.2" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>' },
    sparkles: { label: "创意", body: '<path d="M8 1.8 9.1 5 12.2 6.1 9.1 7.2 8 10.4 6.9 7.2 3.8 6.1 6.9 5 8 1.8ZM12.5 9l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6.6-1.8Z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>' },
    briefcase: { label: "工作", body: '<rect x="2" y="5" width="12" height="8" rx="1.6" stroke="currentColor" stroke-width="1.25"/><path d="M5.5 5V3.3h5V5M2.3 8.2c3.8 1.6 7.6 1.6 11.4 0M8 8.2v2" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>' },
  };
  const PROJECT_ICON_COLORS = ["", "#3b82f6", "#06a7c7", "#22a06b", "#d09614", "#e26736", "#d94f70", "#8b5cf6", "#69717d"];

  function normalizedProjectAppearance(projectId) {
    const value = projectAppearances[String(projectId || "")];
    if (!value || typeof value !== "object") return null;
    const icon = Object.hasOwn(PROJECT_ICON_DEFINITIONS, value.icon) ? value.icon : "folder";
    const color = /^#[0-9a-f]{6}$/i.test(value.color || "") ? value.color : "";
    const label = typeof value.label === "string" ? value.label : "";
    return { icon, color, label };
  }

  function projectIconSvg(iconName, size = 16) {
    const definition = PROJECT_ICON_DEFINITIONS[iconName] || PROJECT_ICON_DEFINITIONS.folder;
    return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" aria-hidden="true" class="icon-xs shrink-0" data-codex-project-icon-glyph="${iconName}">${definition.body}</svg>`;
  }

  function persistProjectAppearances() {
    try {
      localStorage.setItem(PROJECT_APPEARANCE_KEY, JSON.stringify(projectAppearances));
      projectAppearancePersistError = false;
      return true;
    } catch {
      projectAppearancePersistError = true;
      return false;
    }
  }

  function ensureProjectAppearanceIdentity(projectId, projectLabel) {
    const id = String(projectId || "");
    const label = String(projectLabel || "").trim();
    if (!id || !label) return;
    const current = normalizedProjectAppearance(id);
    if (current) {
      if (current.label !== label) {
        projectAppearances[id] = { ...projectAppearances[id], label };
        persistProjectAppearances();
      }
      return;
    }
    const matches = Object.entries(projectAppearances).filter(([candidateId, value]) =>
      candidateId !== id && value && typeof value === "object" && value.label === label,
    );
    if (matches.length !== 1) return;
    projectAppearances[id] = matches[0][1];
    delete projectAppearances[matches[0][0]];
    persistProjectAppearances();
  }

  function applyProjectAppearanceToRow(row) {
    const projectId = row?.getAttribute("data-app-action-sidebar-project-id") || "";
    const iconHost = row?.querySelector('[data-sidebar-project-drop-zone="project-icon"]');
    if (!projectId || !iconHost) return;
    const appearance = normalizedProjectAppearance(projectId);
    if (!appearance) {
      iconHost.querySelector("[data-codex-project-custom-icon-overlay]")?.remove();
      iconHost.removeAttribute("data-codex-project-custom-icon");
      iconHost.removeAttribute("data-codex-project-icon-name");
      iconHost.style.removeProperty("--codex-project-icon-color");
      return;
    }
    let overlay = iconHost.querySelector("[data-codex-project-custom-icon-overlay]");
    if (!overlay) {
      overlay = document.createElement("span");
      overlay.dataset.codexProjectCustomIconOverlay = "true";
      iconHost.appendChild(overlay);
    }
    if (!overlay.querySelector(`[data-codex-project-icon-glyph="${appearance.icon}"]`)) {
      overlay.innerHTML = projectIconSvg(appearance.icon);
    }
    iconHost.dataset.codexProjectCustomIcon = "true";
    iconHost.dataset.codexProjectIconName = appearance.icon;
    if (appearance.color) iconHost.style.setProperty("--codex-project-icon-color", appearance.color);
    else iconHost.style.removeProperty("--codex-project-icon-color");
  }

  function applyAllProjectAppearances() {
    document.querySelectorAll("[data-app-action-sidebar-project-row]").forEach(applyProjectAppearanceToRow);
  }

  function setProjectAppearance(projectId, next, projectLabel = "") {
    const id = String(projectId || "");
    if (!id) return;
    if (!next) delete projectAppearances[id];
    else {
      const current = normalizedProjectAppearance(id) || { icon: "folder", color: "" };
      const icon = Object.hasOwn(PROJECT_ICON_DEFINITIONS, next.icon) ? next.icon : current.icon;
      const color = /^#[0-9a-f]{6}$/i.test(next.color || "") ? next.color : (next.color === "" ? "" : current.color);
      projectAppearances[id] = { icon, color, label: String(projectLabel || current.label || "").trim() };
    }
    persistProjectAppearances();
    applyAllProjectAppearances();
  }

  function closeProjectAppearancePicker({ restoreFocus = false } = {}) {
    const picker = document.getElementById(PROJECT_APPEARANCE_PICKER_ID);
    const trigger = picker?.__codexTrigger;
    picker?.__codexCleanup?.();
    picker?.remove();
    if (restoreFocus && trigger?.isConnected) {
      requestAnimationFrame(() => trigger.isConnected && trigger.focus({ preventScroll: true }));
    }
  }

  function openProjectAppearancePicker(projectId, projectLabel, clientX, clientY, trigger) {
    closeProjectAppearancePicker({ restoreFocus: false });
    const picker = document.createElement("div");
    picker.id = PROJECT_APPEARANCE_PICKER_ID;
    picker.setAttribute("role", "dialog");
    picker.setAttribute("aria-label", `自定义 ${projectLabel} 的项目图标`);

    const header = document.createElement("div");
    header.dataset.projectAppearanceHeader = "true";
    const preview = document.createElement("div");
    preview.dataset.projectAppearancePreview = "true";
    const previewIcon = document.createElement("span");
    previewIcon.dataset.projectAppearancePreviewIcon = "true";
    const previewName = document.createElement("span");
    previewName.dataset.projectAppearanceName = "true";
    previewName.textContent = projectLabel;
    preview.append(previewIcon, previewName);
    const close = document.createElement("button");
    close.type = "button";
    close.dataset.projectAppearanceClose = "true";
    close.setAttribute("aria-label", "关闭图标设置");
    close.innerHTML = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg>';
    close.onclick = () => closeProjectAppearancePicker({ restoreFocus: true });
    header.append(preview, close);

    const iconSection = document.createElement("section");
    iconSection.dataset.projectAppearanceSection = "true";
    const iconLabel = document.createElement("span");
    iconLabel.dataset.projectAppearanceLabel = "true";
    iconLabel.textContent = "图标";
    const iconGrid = document.createElement("div");
    iconGrid.dataset.projectAppearanceIcons = "true";
    iconGrid.setAttribute("role", "group");
    iconGrid.setAttribute("aria-label", "选择项目图标");
    for (const [name, definition] of Object.entries(PROJECT_ICON_DEFINITIONS)) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.projectAppearanceIcon = name;
      button.setAttribute("aria-label", definition.label);
      button.title = definition.label;
      button.innerHTML = projectIconSvg(name, 18);
      button.onclick = () => {
        setProjectAppearance(projectId, { icon: name }, projectLabel);
        refreshPicker();
      };
      iconGrid.appendChild(button);
    }
    iconSection.append(iconLabel, iconGrid);

    const colorSection = document.createElement("section");
    colorSection.dataset.projectAppearanceSection = "true";
    const colorLabel = document.createElement("span");
    colorLabel.dataset.projectAppearanceLabel = "true";
    colorLabel.textContent = "颜色";
    const colors = document.createElement("div");
    colors.dataset.projectAppearanceColors = "true";
    colors.setAttribute("role", "group");
    colors.setAttribute("aria-label", "选择项目图标颜色");
    for (const color of PROJECT_ICON_COLORS) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.projectAppearanceColor = color;
      button.setAttribute("aria-label", color ? `使用颜色 ${color}` : "使用默认颜色");
      button.title = color ? color : "默认颜色";
      if (color) button.style.setProperty("--project-color-swatch", color);
      button.onclick = () => {
        setProjectAppearance(projectId, { color }, projectLabel);
        refreshPicker();
      };
      colors.appendChild(button);
    }
    const customColor = document.createElement("label");
    customColor.dataset.projectAppearanceCustomColor = "true";
    customColor.title = "自定义颜色";
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.setAttribute("aria-label", "自定义项目图标颜色");
    colorInput.oninput = () => {
      setProjectAppearance(projectId, { color: colorInput.value }, projectLabel);
      refreshPicker();
    };
    customColor.appendChild(colorInput);
    colors.appendChild(customColor);
    colorSection.append(colorLabel, colors);

    const footer = document.createElement("footer");
    footer.dataset.projectAppearanceFooter = "true";
    const saveError = document.createElement("span");
    saveError.dataset.projectAppearanceSaveError = "true";
    saveError.setAttribute("role", "status");
    saveError.textContent = "未能保存到本机";
    const reset = document.createElement("button");
    reset.type = "button";
    reset.dataset.projectAppearanceReset = "true";
    reset.textContent = "恢复默认";
    reset.onclick = () => {
      setProjectAppearance(projectId, null);
      refreshPicker();
    };
    footer.append(saveError, reset);
    picker.append(header, iconSection, colorSection, footer);

    function refreshPicker() {
      const appearance = normalizedProjectAppearance(projectId) || { icon: "folder", color: "" };
      previewIcon.innerHTML = projectIconSvg(appearance.icon, 17);
      previewIcon.style.setProperty("--codex-project-icon-color", appearance.color || "currentColor");
      iconGrid.style.setProperty("--codex-project-icon-color", appearance.color || "currentColor");
      iconGrid.querySelectorAll("[data-project-appearance-icon]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.projectAppearanceIcon === appearance.icon));
      });
      colors.querySelectorAll("[data-project-appearance-color]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.projectAppearanceColor === appearance.color));
      });
      colorInput.value = appearance.color || "#3b82f6";
      reset.disabled = !normalizedProjectAppearance(projectId);
      saveError.hidden = !projectAppearancePersistError;
    }

    document.body.appendChild(picker);
    refreshPicker();
    const rect = picker.getBoundingClientRect();
    picker.style.left = `${Math.max(8, Math.min(clientX, innerWidth - rect.width - 8))}px`;
    picker.style.top = `${Math.max(8, Math.min(clientY, innerHeight - rect.height - 8))}px`;
    const controller = new AbortController();
    picker.__codexTrigger = trigger;
    picker.__codexCleanup = () => controller.abort();
    document.addEventListener("pointerdown", (event) => {
      if (!picker.contains(event.target)) closeProjectAppearancePicker({ restoreFocus: false });
    }, { capture: true, signal: controller.signal });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeProjectAppearancePicker({ restoreFocus: true });
    }, { capture: true, signal: controller.signal });
    document.addEventListener("scroll", () => closeProjectAppearancePicker({ restoreFocus: false }), { capture: true, signal: controller.signal });
    window.addEventListener("resize", () => closeProjectAppearancePicker({ restoreFocus: false }), { signal: controller.signal });
    requestAnimationFrame(() => iconGrid.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true }));
  }

  function ensureProjectAppearanceCustomization() {
    for (const row of document.querySelectorAll("[data-app-action-sidebar-project-row]")) {
      const projectId = row.getAttribute("data-app-action-sidebar-project-id") || "";
      const projectLabel = row.getAttribute("data-app-action-sidebar-project-label") || row.getAttribute("aria-label") || "项目";
      ensureProjectAppearanceIdentity(projectId, projectLabel);
      applyProjectAppearanceToRow(row);
      if (row.dataset.codexProjectAppearanceBound === RUNTIME_TOKEN) continue;
      row.dataset.codexProjectAppearanceBound = RUNTIME_TOKEN;
      row.addEventListener("contextmenu", (event) => {
        const projectId = row.getAttribute("data-app-action-sidebar-project-id") || "";
        const projectLabel = row.getAttribute("data-app-action-sidebar-project-label") || row.getAttribute("aria-label") || "项目";
        if (!projectId) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const rect = row.getBoundingClientRect();
        const x = event.clientX || rect.left + 24;
        const y = event.clientY || rect.bottom;
        openProjectAppearancePicker(projectId, projectLabel, x, y, row);
      }, { capture: true, signal: projectAppearanceAbortController.signal });
    }
  }

  function sidebarProjectIcon(projectId) {
    const appearance = normalizedProjectAppearance(projectId) || { icon: "folder", color: "" };
    return `<span data-codex-project-custom-icon="true" style="${appearance.color ? `--codex-project-icon-color:${appearance.color}` : ""}">${projectIconSvg(appearance.icon, 15)}</span>`;
  }

  function openSidebarProject(record) {
    const task = record?.tasks?.[0];
    if (!task?.threadId) return;
    const route = homeProjectRoute(task.threadId);
    if (route) window.postMessage({ type: "navigate-to-route", path: route }, "*");
  }

  function renderSidebarProjectManager() {
    const manager = document.getElementById(PROJECT_MANAGER_ID);
    if (!manager) return;
    const list = manager.querySelector("[data-codex-sidebar-project-list]");
    const records = sidebarProjectRecords();
    manager.querySelector("[data-codex-sidebar-project-count]").textContent = records.length ? `${records.length} 个` : "";
    list.replaceChildren();
    if (!records.length) {
      const empty = document.createElement("div");
      empty.dataset.codexSidebarProjectEmpty = "true";
      empty.textContent = "暂无可显示的项目";
      list.appendChild(empty);
      return;
    }
    for (const record of records) {
      const entry = document.createElement("button");
      entry.type = "button";
      entry.dataset.codexSidebarProjectEntry = record.id;
      entry.setAttribute("aria-label", `打开项目 ${record.name}`);
      entry.title = record.tasks[0]?.title ? `${record.name}：${record.tasks[0].title}` : record.name;
      const copy = document.createElement("span");
      copy.dataset.codexSidebarProjectCopy = "true";
      const name = document.createElement("span");
      name.dataset.codexSidebarProjectName = "true";
      name.textContent = record.name;
      const meta = document.createElement("span");
      meta.dataset.codexSidebarProjectMeta = "true";
      const taskCount = Math.max(record.tasks.length, record.activeTaskCount);
      meta.textContent = taskCount ? `${taskCount} 个任务${record.pinned ? " · 已置顶" : ""}` : (record.pinned ? "已置顶" : "暂无任务");
      copy.append(name, meta);
      entry.innerHTML = sidebarProjectIcon(record.id);
      entry.appendChild(copy);
      entry.addEventListener("click", () => openSidebarProject(record));
      list.appendChild(entry);
    }
  }

  function ensureProjectSidebarManager() {
    captureNativeProjectRows();
    const source = nativeProjectNavigationSource();
    if (!source) {
      document.getElementById(PROJECT_MANAGER_ID)?.remove();
      projectNavigationCleanup?.();
      projectNavigationCleanup = null;
      projectNavigationSource = null;
      return;
    }
    if (projectNavigationSource !== source.button) {
      projectNavigationCleanup?.();
      const handleProjectNavigation = (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        projectManagerOpen = true;
        source.button.setAttribute("aria-expanded", "true");
        const manager = document.getElementById(PROJECT_MANAGER_ID);
        if (manager) manager.hidden = false;
        renderSidebarProjectManager();
      };
      source.button.addEventListener("click", handleProjectNavigation, true);
      projectNavigationCleanup = () => source.button.removeEventListener("click", handleProjectNavigation, true);
      projectNavigationSource = source.button;
    }
    let manager = document.getElementById(PROJECT_MANAGER_ID);
    if (!manager || manager.parentElement !== source.row.parentElement || manager.previousElementSibling !== source.row) {
      manager?.remove();
      manager = document.createElement("section");
      manager.id = PROJECT_MANAGER_ID;
      manager.dataset.codexPreviewRuntime = RUNTIME_TOKEN;
      manager.hidden = false;
      const header = document.createElement("div");
      header.dataset.codexSidebarProjectManagerHeader = "true";
      header.innerHTML = `<span>项目</span><span data-codex-sidebar-project-count></span>`;
      const list = document.createElement("div");
      list.dataset.codexSidebarProjectList = "true";
      manager.append(header, list);
      source.row.parentElement.insertBefore(manager, source.row.nextElementSibling);
    }
    manager.hidden = false;
    source.button.setAttribute("aria-expanded", "true");
    renderSidebarProjectManager();
  }

  function clearProjectSidebarManager() {
    projectNavigationCleanup?.();
    projectNavigationCleanup = null;
    projectNavigationSource = null;
    document.getElementById(PROJECT_MANAGER_ID)?.remove();
    const source = nativeProjectNavigationSource();
    source?.button.removeAttribute("aria-expanded");
  }

  function shortcutLayout(items, compact) {
    const available = compact ? items.filter((item) => item.panelKind !== "asset") : items;
    const primary = compact ? available.filter((item) => item.name === "新对话" || item.panelKind) : available;
    return { primary, overflow: compact ? available.filter((item) => !primary.includes(item)) : [] };
  }

  function createShortcutOverflow(items, grid) {
    const details = document.createElement("details");
    details.dataset.codexShortcutMore = "true";
    const summary = document.createElement("summary");
    summary.textContent = "⋯";
    summary.setAttribute("aria-label", "更多快捷入口");
    summary.title = "更多";
    const content = document.createElement("div");
    content.dataset.codexShortcutMoreItems = "true";
    content.append(...items.map(createShortcutCard));
    details.append(summary, content);
    const close = (restoreFocus = false) => {
      if (!details.open) return;
      details.open = false;
      if (restoreFocus) summary.focus();
    };
    content.addEventListener("click", (event) => {
      if (event.target.closest("button")) close(details.contains(document.activeElement));
    });
    content.addEventListener("wheel", (event) => event.stopPropagation());
    const controller = new AbortController();
    grid.__codexShortcutMoreCleanup = () => controller.abort();
    document.addEventListener("pointerdown", (event) => {
      if (!details.contains(event.target)) close();
    }, { signal: controller.signal, capture: true });
    const handleEscape = (event) => {
      if (event.key !== "Escape" || !details.open) return;
      event.preventDefault();
      event.stopPropagation();
      close(true);
    };
    // Native window shortcuts can consume keydown before document capture.
    for (const type of ["keydown", "keyup"]) {
      document.addEventListener(type, handleEscape, { signal: controller.signal, capture: true });
    }
    return details;
  }

  function clearShortcutEnhancement() {
    const grid = document.getElementById(SHORTCUT_GRID_ID);
    grid?.__codexShortcutMoreCleanup?.();
    grid?.remove();
    document.querySelectorAll("[data-codex-sidebar-shortcut-source-hidden]").forEach((node) => {
      node.removeAttribute("data-codex-sidebar-shortcut-source-hidden");
    });
    document.querySelectorAll("[data-codex-sidebar-shortcut-source-group-hidden]").forEach((node) => {
      node.removeAttribute("data-codex-sidebar-shortcut-source-group-hidden");
    });
    document.querySelectorAll("[data-codex-sidebar-shortcut-source-name]").forEach((node) => {
      node.removeAttribute("data-codex-sidebar-shortcut-source-name");
    });
    shortcutSources = new Map();
    removeSidebarControlsHostIfEmpty();
  }

  function ensureShortcutGrid() {
    const sources = nativeShortcutSources();
    if (!sources || sources.items.length < 2) return;
    let controls = ensureSidebarControlsHost(sources.header);
    if (!controls) return;
    const compact = isTaskShell();
    const layout = shortcutLayout(sources.items, compact);
    let grid = document.getElementById(SHORTCUT_GRID_ID);
    const needsRebuild = grid?.dataset.codexPreviewRuntime !== RUNTIME_TOKEN
      || grid?.parentElement !== controls
      || grid?.dataset.codexShortcutCompact !== String(compact)
      || shortcutSources.size !== sources.items.length
      || sources.items.some((item) => shortcutSources.get(item.name) !== item.button);
    if (needsRebuild) {
      clearShortcutEnhancement();
      controls = ensureSidebarControlsHost(sources.header);
      if (!controls) return;
      grid = document.createElement("div");
      grid.id = SHORTCUT_GRID_ID;
      grid.setAttribute("role", "group");
      grid.setAttribute("aria-label", "快捷入口");
      grid.dataset.codexPreviewRuntime = RUNTIME_TOKEN;
      grid.dataset.codexShortcutCompact = String(compact);
      grid.replaceChildren(...layout.primary.map(createShortcutCard));
      if (layout.overflow.length) grid.appendChild(createShortcutOverflow(layout.overflow, grid));
      controls.insertBefore(grid, controls.firstChild);
      shortcutSources = new Map(sources.items.map((item) => [item.name, item.button]));
    }
    grid.style.setProperty("--codex-sidebar-shortcut-columns", String(layout.primary.length || 1));
    sources.newConversationRow.setAttribute("data-codex-sidebar-shortcut-source-hidden", "true");
    sources.navigationGroup.setAttribute("data-codex-sidebar-shortcut-source-group-hidden", "true");
    sources.navigationContainer.setAttribute("data-codex-sidebar-shortcut-source-group-hidden", "true");
    for (const item of sources.items) {
      if (item.button) item.button.dataset.codexSidebarShortcutSourceName = item.name;
      updateShortcutCard(grid, item);
    }
  }

  function sectionLabel(button) {
    return button?.querySelector("span.min-w-0.truncate")?.textContent?.trim()
      || button?.textContent?.trim()
      || "";
  }

  function nativeSectionSource(name) {
    const button = Array.from(document.querySelectorAll("button[data-app-action-sidebar-section-toggle]"))
      .find((candidate) => !candidate.closest(`#${SECTION_TABS_ID}`) && sectionLabel(candidate) === name);
    if (!button) return null;
    let heading = button.parentElement;
    while (heading && !heading.classList.contains("group/nav-section-title")) heading = heading.parentElement;
    const section = heading?.closest("section");
    if (!heading || !section) return null;
    return { name, button, heading, section, panelHost: null, actions: null };
  }

  function commonAncestor(nodes) {
    if (!nodes.length) return null;
    let candidate = nodes[0]?.parentElement;
    while (candidate && !nodes.every((node) => candidate.contains(node))) candidate = candidate.parentElement;
    return candidate;
  }

  function topLevelPanelHost(section, common) {
    let host = section;
    while (host?.parentElement && host.parentElement !== common) host = host.parentElement;
    return host?.parentElement === common ? host : section;
  }

  function nativeSectionSources() {
    const items = SECTION_NAMES.map(nativeSectionSource);
    if (items.some((item) => !item)) return null;
    const common = commonAncestor(items.map((item) => item.section));
    if (!common) return null;
    for (const item of items) item.panelHost = topLevelPanelHost(item.section, common);
    const existingActions = document.querySelector(`#${SECTION_TABS_ID} [data-codex-sidebar-project-actions-source]`);
    items.find((item) => item.name === "项目").actions = items.find((item) => item.name === "项目").heading.children[1]
      || existingActions
      || null;
    return { common, items };
  }

  function sectionIdPart(name) {
    return name === "置顶" ? "pinned" : name === "项目" ? "projects" : "recent";
  }

  function setNativeSectionExpanded(item, desired) {
    const expanded = item.button.getAttribute("aria-expanded") === "true";
    if (expanded === desired) {
      sectionTogglePending.delete(item.name);
      return;
    }
    const pending = sectionTogglePending.get(item.name);
    if (pending?.button === item.button && pending.desired === desired && Date.now() - pending.startedAt < 1_200) return;
    sectionTogglePending.set(item.name, { button: item.button, desired, startedAt: Date.now() });
    item.button.click();
  }

  function updateSectionTabState(items, { syncNative = true } = {}) {
    const bar = document.getElementById(SECTION_TABS_ID);
    if (!bar || !activeSectionTab) return;
    for (const item of items) {
      const selected = item.name === activeSectionTab;
      const part = sectionIdPart(item.name);
      const tab = bar.querySelector(`[data-codex-sidebar-section-tab="${item.name}"]`);
      tab?.setAttribute("aria-selected", String(selected));
      if (tab) tab.tabIndex = selected ? 0 : -1;
      item.panelHost.hidden = !selected;
      item.section.hidden = !selected;
      item.section.id = `codex-sidebar-section-panel-${part}`;
      item.section.setAttribute("role", "tabpanel");
      item.section.setAttribute("aria-labelledby", `codex-sidebar-section-tab-${part}`);
      item.section.dataset.codexSidebarSectionPanel = item.name;
      item.heading.dataset.codexSidebarSectionHeadingHidden = "true";
      if (syncNative) setNativeSectionExpanded(item, selected);
    }
    const actions = bar.querySelector("[data-codex-sidebar-project-actions]");
    if (actions) actions.hidden = activeSectionTab !== "项目";
  }

  function selectSectionTab(name, { focus = false } = {}) {
    if (!SECTION_NAMES.includes(name)) return;
    activeSectionTab = name;
    try { localStorage.setItem(SECTION_TAB_STORAGE_KEY, name); } catch {}
    const items = SECTION_NAMES.map((sectionName) => sectionSources.get(sectionName)).filter(Boolean);
    updateSectionTabState(items);
    const tab = document.querySelector(`#${SECTION_TABS_ID} [data-codex-sidebar-section-tab="${name}"]`);
    if (focus) tab?.focus();
    scheduleSync();
  }

  function handleSectionTabKeydown(event) {
    const current = event.currentTarget?.dataset?.codexSidebarSectionTab;
    const index = SECTION_NAMES.indexOf(current);
    if (index < 0) return;
    let next = null;
    if (event.key === "ArrowRight") next = SECTION_NAMES[(index + 1) % SECTION_NAMES.length];
    else if (event.key === "ArrowLeft") next = SECTION_NAMES[(index - 1 + SECTION_NAMES.length) % SECTION_NAMES.length];
    else if (event.key === "Home") next = SECTION_NAMES[0];
    else if (event.key === "End") next = SECTION_NAMES.at(-1);
    if (!next) return;
    event.preventDefault();
    selectSectionTab(next, { focus: true });
  }

  function createSectionTabs() {
    const bar = document.createElement("div");
    bar.id = SECTION_TABS_ID;
    bar.dataset.codexPreviewRuntime = RUNTIME_TOKEN;
    const tablist = document.createElement("div");
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-label", "对话分组");
    for (const name of SECTION_NAMES) {
      const tab = document.createElement("button");
      const part = sectionIdPart(name);
      tab.type = "button";
      tab.id = `codex-sidebar-section-tab-${part}`;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", `codex-sidebar-section-panel-${part}`);
      tab.dataset.codexSidebarSectionTab = name;
      tab.textContent = name;
      tab.onclick = () => selectSectionTab(name);
      tab.onkeydown = handleSectionTabKeydown;
      tablist.appendChild(tab);
    }
    const actions = document.createElement("div");
    actions.dataset.codexSidebarProjectActions = "true";
    actions.setAttribute("aria-label", "项目操作");
    bar.append(tablist, actions);
    return bar;
  }

  function restoreProjectActions() {
    const project = sectionSources.get("项目");
    const actions = project?.actions;
    if (!actions) return;
    actions.removeAttribute("data-codex-sidebar-project-actions-source");
    actions.querySelectorAll("button[data-codex-sidebar-project-action-source]").forEach((button) => {
      button.removeAttribute("data-codex-sidebar-project-action-source");
    });
    if (project.heading?.isConnected && actions.parentElement !== project.heading && project.heading.children.length < 2) {
      project.heading.appendChild(actions);
    }
  }

  function clearSectionEnhancement() {
    clearFolderEnhancement();
    document.documentElement.removeAttribute(COMPANY_WORKBENCH_MODE_ATTR);
    restoreProjectActions();
    document.getElementById(SECTION_TABS_ID)?.remove();
    document.querySelectorAll("[data-codex-sidebar-section-heading-hidden]").forEach((heading) => {
      heading.removeAttribute("data-codex-sidebar-section-heading-hidden");
    });
    document.querySelectorAll("[data-codex-sidebar-section-panel]").forEach((section) => {
      section.removeAttribute("data-codex-sidebar-section-panel");
      section.removeAttribute("role");
      section.removeAttribute("aria-labelledby");
      section.removeAttribute("id");
    });
    for (const item of sectionSources.values()) {
      item.panelHost.hidden = false;
      item.section.hidden = false;
    }
    sectionSources = new Map();
    sectionTogglePending = new Map();
    activeSectionTab = null;
    removeSidebarControlsHostIfEmpty();
  }

  function ensureSectionTabs() {
    const sources = nativeSectionSources();
    if (!sources) return;
    const scroll = document.querySelector("[data-app-action-sidebar-scroll]");
    let controls = ensureSidebarControlsHost(scroll);
    if (!controls) return;
    if (!activeSectionTab) {
      const hasProjects = Boolean(document.querySelector("[data-app-action-sidebar-project-row]"));
      activeSectionTab = hasProjects
        ? sources.items.find((item) => item.button.getAttribute("aria-expanded") === "true")?.name || "项目"
        : "最近";
    }
    let bar = document.getElementById(SECTION_TABS_ID);
    const projectActions = sources.items.find((item) => item.name === "项目")?.actions;
    const needsRebuild = bar?.dataset.codexPreviewRuntime !== RUNTIME_TOKEN
      || bar?.parentElement !== controls
      || sources.items.some((item) => sectionSources.get(item.name)?.section !== item.section)
      || sectionSources.get("项目")?.actions !== projectActions;
    if (needsRebuild) {
      clearSectionEnhancement();
      controls = ensureSidebarControlsHost(scroll);
      if (!controls) return;
      bar = createSectionTabs();
      controls.appendChild(bar);
      sectionSources = new Map(sources.items.map((item) => [item.name, item]));
    }
    const project = sources.items.find((item) => item.name === "项目");
    const actionsHost = bar.querySelector("[data-codex-sidebar-project-actions]");
    if (project?.actions && project.actions.parentElement !== actionsHost) {
      project.actions.dataset.codexSidebarProjectActionsSource = "true";
      project.actions.querySelectorAll("button").forEach((button) => {
        const label = button.getAttribute("aria-label") || "项目操作";
        button.dataset.codexSidebarProjectActionSource = label;
      });
      actionsHost.appendChild(project.actions);
    }
    updateSectionTabState(sources.items);
  }

  function folderLastUsed(folder) {
    let latest = 0;
    for (const row of folder.querySelectorAll(ROW_SELECTOR)) {
      const time = Date.parse(previews.get(rowKey(row))?.updatedAt || "");
      if (Number.isFinite(time) && time > latest) latest = time;
    }
    return latest;
  }

  function nativeFolderSources() {
    const rows = Array.from(document.querySelectorAll("[data-app-action-sidebar-project-row]"));
    if (!rows.length) return null;
    const items = rows.flatMap((row, sourceIndex) => {
      const id = row.getAttribute("data-app-action-sidebar-project-id") || "";
      const label = row.getAttribute("data-app-action-sidebar-project-label") || row.getAttribute("aria-label") || "";
      const folder = row.closest("[data-sidebar-project-kind]");
      let listRoot = folder?.parentElement;
      while (listRoot && listRoot.getAttribute("role") !== "list") listRoot = listRoot.parentElement;
      if (!id || !label || !folder || !listRoot) return [];
      const panelHost = topLevelPanelHost(folder, listRoot);
      const existingActions = document.querySelector(`#${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-actions-source="${CSS.escape(id)}"]`);
      const rowActions = Array.from(row.children).find((child) =>
        Array.from(child.querySelectorAll?.("button") || []).some((button) =>
          button.getAttribute("aria-label") === `${label} 的项目操作`,
        ),
      );
      const threadTitles = Array.from(folder.querySelectorAll(ROW_SELECTOR))
        .map((thread) => thread.getAttribute("data-app-action-sidebar-thread-title") || "")
        .filter(Boolean);
      const catalogEntries = searchCatalogByProject.get(id) || [];
      const catalogTitles = catalogEntries.map((entry) => entry.title);
      const catalogLastUsed = catalogEntries.reduce((latest, entry) => {
        const time = Date.parse(entry.updatedAt || "");
        return Number.isFinite(time) && time > latest ? time : latest;
      }, 0);
      return [{
        id,
        label,
        row,
        folder,
        listRoot,
        panelHost,
        actions: rowActions || existingActions || null,
        sourceIndex,
        threadTitles,
        catalogEntries,
        searchText: [label, ...threadTitles, ...catalogTitles].join(" "),
        lastUsed: Math.max(folderLastUsed(folder), catalogLastUsed),
        active: Boolean(folder.querySelector('[aria-current="page"], [data-app-action-sidebar-thread-active="true"]')),
      }];
    });
    if (!items.length || items.some((item) => item.listRoot !== items[0].listRoot)) return null;
    return { listRoot: items[0].listRoot, items };
  }

  function requestCompleteNativeFolderList(sources) {
    const expandButton = Array.from(sources.listRoot.children)
      .map((child) => child.querySelector(":scope > button"))
      .find((button) => button?.textContent?.trim() === "展开显示");
    if (!expandButton || expandButton.dataset.codexSidebarFolderListExpansionRequested === "true") return false;
    expandButton.dataset.codexSidebarFolderListExpansionRequested = "true";
    expandButton.click();
    scheduleSync();
    return true;
  }

  function normalizeFolderSearch(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(/[\s\p{P}\p{S}]+/gu, "");
  }

  function fuzzyFolderScore(value, query) {
    const text = normalizeFolderSearch(value);
    const needle = normalizeFolderSearch(query);
    if (!needle) return 0;
    if (!text) return Infinity;
    if (text === needle) return 0;
    if (text.startsWith(needle)) return 10 + text.length - needle.length;
    const includedAt = text.indexOf(needle);
    if (includedAt >= 0) return 30 + includedAt + (text.length - needle.length) / 100;
    let cursor = -1;
    let gaps = 0;
    for (const character of needle) {
      const next = text.indexOf(character, cursor + 1);
      if (next < 0) return Infinity;
      if (cursor >= 0) gaps += next - cursor - 1;
      cursor = next;
    }
    return 80 + gaps + (text.length - needle.length) / 100;
  }

  function rankedFolders(items, query = folderSearchQuery) {
    const needle = normalizeFolderSearch(query);
    return items
      .map((item) => ({ ...item, searchScore: needle ? fuzzyFolderScore(item.searchText, needle) : 0 }))
      .filter((item) => Number.isFinite(item.searchScore))
      .sort((left, right) => needle
        ? left.searchScore - right.searchScore || right.lastUsed - left.lastUsed || left.sourceIndex - right.sourceIndex
        : right.lastUsed - left.lastUsed || left.sourceIndex - right.sourceIndex);
  }

  function normalizedThreadId(value) {
    return String(value || "").trim().replace(/^(?:local|cloud):/i, "").toLocaleLowerCase();
  }

  function catalogMatchesForFolder(item, query = folderSearchQuery) {
    const needle = normalizeFolderSearch(query);
    if (!needle) return [];
    return (item?.catalogEntries || [])
      .map((entry) => ({ ...entry, searchScore: fuzzyFolderScore(entry.title, needle) }))
      .filter((entry) => Number.isFinite(entry.searchScore))
      .sort((left, right) => left.searchScore - right.searchScore
        || Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || ""));
  }

  function revealFolderSearchMatch(item) {
    document.querySelectorAll(`${ROW_SELECTOR}[data-codex-sidebar-search-match="true"]`).forEach((row) => {
      row.removeAttribute("data-codex-sidebar-search-match");
    });
    if (!item || item.id !== activeFolderId || !normalizeFolderSearch(folderSearchQuery)) {
      folderSearchExpansionPending = null;
      folderSearchRevealKey = "";
      return;
    }
    const matches = catalogMatchesForFolder(item);
    if (!matches.length) return;
    const matchingIds = new Set(matches.map((entry) => normalizedThreadId(entry.threadId)));
    const matchingTitles = new Set(matches.map((entry) => entry.title));
    const rows = Array.from(item.folder.querySelectorAll(ROW_SELECTOR));
    const match = rows.find((row) => matchingIds.has(normalizedThreadId(
      row.getAttribute("data-app-action-sidebar-thread-id"),
    ))) || rows.find((row) => matchingTitles.has(
      row.getAttribute("data-app-action-sidebar-thread-title") || "",
    ));
    if (match) {
      folderSearchExpansionPending = null;
      match.dataset.codexSidebarSearchMatch = "true";
      const revealKey = `${normalizeFolderSearch(folderSearchQuery)}:${rowKey(match)}`;
      if (folderSearchRevealKey !== revealKey) {
        folderSearchRevealKey = revealKey;
        requestAnimationFrame(() => match.scrollIntoView({ block: "nearest" }));
      }
      return;
    }
    const expandButton = Array.from(item.folder.querySelectorAll("button"))
      .find((button) => button.textContent?.trim() === "展开显示");
    if (!expandButton) return;
    if (folderSearchExpansionPending?.id === item.id
      && folderSearchExpansionPending?.rowCount === rows.length) return;
    folderSearchExpansionPending = { id: item.id, rowCount: rows.length };
    expandButton.click();
    scheduleSync();
  }

  function setNativeFolderExpanded(item) {
    if (item.row.getAttribute("aria-expanded") === "true") {
      folderTogglePending.delete(item.id);
      return;
    }
    // React can replace the native row after a click. Keep the request by
    // project id so mutation-driven syncs do not click the replacement again.
    if (folderTogglePending.has(item.id)) return;
    folderTogglePending.set(item.id, { startedAt: Date.now() });
    item.row.click();
  }

  function restoreFolderActions() {
    const source = document.querySelector(`#${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-actions-source]`);
    if (!source) return;
    const id = source.getAttribute("data-codex-sidebar-folder-actions-source");
    const item = folderSources.get(id);
    const row = item?.row || document.querySelector(`[data-app-action-sidebar-project-id="${CSS.escape(id)}"]`);
    source.removeAttribute("data-codex-sidebar-folder-actions-source");
    source.querySelectorAll("[data-codex-sidebar-folder-action-source]").forEach((button) => {
      button.removeAttribute("data-codex-sidebar-folder-action-source");
    });
    if (row?.isConnected && source.parentElement !== row) {
      const selectProject = Array.from(row.children).find((child) => child.matches?.("button[data-app-action-sidebar-select-project]"));
      row.insertBefore(source, selectProject || null);
    }
  }

  function moveActiveFolderActions(item) {
    const root = document.getElementById(FOLDER_SWITCHER_ID);
    const host = root?.querySelector("[data-codex-sidebar-folder-actions]");
    if (!host) return;
    const current = host.querySelector("[data-codex-sidebar-folder-actions-source]");
    if (current && current !== item?.actions) restoreFolderActions();
    if (!item?.actions) {
      host.hidden = true;
      return;
    }
    item.actions.dataset.codexSidebarFolderActionsSource = item.id;
    item.actions.querySelectorAll("button").forEach((button) => {
      button.dataset.codexSidebarFolderActionSource = button.getAttribute("aria-label") || item.label;
    });
    if (item.actions.parentElement !== host) host.appendChild(item.actions);
    host.hidden = false;
  }

  function selectFolder(id, { focus = false, persist = !normalizeFolderSearch(folderSearchQuery) } = {}) {
    if (!folderSources.has(id)) return;
    activeFolderId = id;
    if (persist) {
      try { localStorage.setItem(FOLDER_STORAGE_KEY, id); } catch {}
    }
    updateFolderSwitcherState(Array.from(folderSources.values()));
    const tag = document.querySelector(`#${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-tag="${CSS.escape(id)}"]`);
    if (focus) tag?.focus();
    scheduleSync();
  }

  function handleFolderTagKeydown(event) {
    const tags = Array.from(document.querySelectorAll(`#${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-tag]`));
    const index = tags.indexOf(event.currentTarget);
    if (index < 0) return;
    let next = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = tags[(index + 1) % tags.length];
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = tags[(index - 1 + tags.length) % tags.length];
    else if (event.key === "Home") next = tags[0];
    else if (event.key === "End") next = tags.at(-1);
    if (!next) return;
    event.preventDefault();
    selectFolder(next.dataset.codexSidebarFolderTag, { focus: true });
  }

  function createFolderTag(item) {
    const tag = document.createElement("button");
    tag.type = "button";
    tag.id = `codex-sidebar-folder-tag-${item.id}`;
    tag.dataset.codexSidebarFolderTag = item.id;
    tag.dataset.codexSidebarFolderId = item.id;
    tag.dataset.codexSidebarFolderLabel = item.label;
    tag.dataset.codexSidebarFolderLastUsed = String(item.lastUsed || 0);
    tag.setAttribute("aria-controls", `codex-sidebar-folder-panel-${item.id}`);
    tag.setAttribute("aria-label", `显示文件夹 ${item.label}`);
    tag.title = item.label;
    tag.textContent = item.label;
    tag.onclick = () => selectFolder(item.id);
    tag.onkeydown = handleFolderTagKeydown;
    return tag;
  }

  function clearFolderSearch() {
    const input = document.querySelector(`#${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-search]`);
    if (input) input.value = "";
    folderSearchQuery = "";
    folderSearchExpansionPending = null;
    folderSearchRevealKey = "";
    if (folderPreSearchId && folderSources.has(folderPreSearchId)) activeFolderId = folderPreSearchId;
    folderPreSearchId = null;
    updateFolderSwitcherState(Array.from(folderSources.values()));
  }

  function currentConversationThreadId() {
    const composerId = document.querySelector(
      '[data-codex-composer-root][data-composer-placement="thread"] [data-above-composer-conversation-id]',
    )?.getAttribute("data-above-composer-conversation-id")
      || document.querySelector("[data-above-composer-conversation-id]")
        ?.getAttribute("data-above-composer-conversation-id");
    return String(composerId || resolvedCurrentThreadSnapshot()?.threadId || "")
      .replace(/^(?:local|cloud):/i, "");
  }

  function promptDepthThreadId() {
    // The home/new-conversation composer has no conversation id yet. Keep a
    // dedicated key so the control can still render and retain its choice
    // until the first message creates the real thread.
    return normalizedThreadId(currentConversationThreadId()) || "__new_conversation__";
  }

  function promptDepthForThread(threadId = promptDepthThreadId()) {
    const value = promptDepthByThread.get(normalizedThreadId(threadId));
    if (value && typeof value === "object") {
      return {
        workflow: PROMPT_DEPTH_VALUES.includes(value.workflow) ? value.workflow : "none",
        complexity: PROMPT_COMPLEXITY_VALUES.includes(value.complexity) ? value.complexity : "high",
      };
    }
    return { workflow: "none", complexity: "high" };
  }

  function persistPromptDepths() {
    try {
      const values = Object.fromEntries([...promptDepthByThread.entries()]
        .filter(([key, value]) => key && value && PROMPT_DEPTH_VALUES.includes(value.workflow))
        .map(([key, value]) => [key, {
          workflow: value.workflow,
          complexity: PROMPT_COMPLEXITY_VALUES.includes(value.complexity) ? value.complexity : "high",
        }]));
      localStorage.setItem(PROMPT_DEPTH_STORAGE_KEY, JSON.stringify(values));
    } catch {}
  }

  function promptDepthButtonLabel(mode) {
    return PROMPT_DEPTH_LABELS[mode] || PROMPT_DEPTH_LABELS.none;
  }

  function closePromptDepthMenu({ focus = false } = {}) {
    promptDepthMenuCleanup?.();
    promptDepthMenuCleanup = null;
    const menu = document.getElementById(PROMPT_DEPTH_MENU_ID);
    if (menu) {
      menu.hidden = true;
      menu.removeAttribute("data-open-thread-id");
    }
    const trigger = promptDepthMenuTrigger;
    if (trigger?.isConnected) {
      trigger.setAttribute("aria-expanded", "false");
      trigger.dataset.state = "closed";
      if (focus) trigger.focus();
    }
    promptDepthMenuTrigger = null;
  }

  function positionPromptDepthMenu() {
    const menu = document.getElementById(PROMPT_DEPTH_MENU_ID);
    const trigger = promptDepthMenuTrigger;
    if (!menu || !trigger?.isConnected || menu.hidden) return;
    const rect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const menuWidth = menu.offsetWidth || menuRect.width;
    const menuHeight = menu.offsetHeight || menuRect.height;
    const margin = 6;
    const left = Math.max(margin, Math.min(rect.right - menuWidth, innerWidth - menuWidth - margin));
    const above = rect.top - menuHeight - margin;
    const below = rect.bottom + margin;
    const top = above >= margin
      ? above
      : Math.min(below, innerHeight - menuHeight - margin);
    menu.style.left = "auto";
    menu.style.top = "auto";
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    menu.style.right = "auto";
    menu.style.bottom = "auto";
  }

  function syncPromptDepthMenuOptions(value = promptDepthForThread()) {
    const menu = document.getElementById(PROMPT_DEPTH_MENU_ID);
    if (!menu) return;
    menu.querySelectorAll("[data-prompt-depth-option]").forEach((option) => {
      const active = option.dataset.promptDepthOption === value.workflow;
      option.setAttribute("aria-checked", String(active));
      option.dataset.selected = String(active);
    });
    const range = menu.querySelector("[data-prompt-complexity-range]");
    if (range instanceof HTMLInputElement) {
      const index = Math.max(0, PROMPT_COMPLEXITY_VALUES.indexOf(value.complexity));
      range.value = String(index);
      const root = range.closest("[data-prompt-slider-root]");
      if (root) {
        const fillPercent = index === 0 ? "0%" : index === 2 ? "100%" : "50%";
        const thumbPercent = index === 0 ? "14px" : index === 2 ? "calc(100% - 14px)" : "50%";
        root.style.setProperty("--prompt-slider-fill-percent", fillPercent);
        root.style.setProperty("--prompt-slider-thumb-percent", thumbPercent);
        root.querySelectorAll("[data-prompt-slider-tick]").forEach((tick, tickIndex) => {
          tick.dataset.selected = String(tickIndex <= index);
        });
      }
    }
    const description = menu.querySelector("[data-prompt-complexity-description]");
    if (description) description.textContent = PROMPT_COMPLEXITY_DESCRIPTIONS[value.complexity] || "";
  }

  function ensurePromptDepthMenu() {
    let menu = document.getElementById(PROMPT_DEPTH_MENU_ID);
    if (menu) return menu;
    menu = document.createElement("div");
    menu.id = PROMPT_DEPTH_MENU_ID;
    menu.hidden = true;
    menu.className = "no-drag z-50 m-px flex select-none flex-col overflow-y-auto bg-surface-elevated-secondary/90 text-default ring-border ring-[0.5px] shadow-xl-spread backdrop-blur-sm rounded-2xl p-[var(--menu-gutter,var(--spacing))] w-56 overflow-x-hidden overflow-y-hidden [--menu-gutter:0px]";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "拆提示词设置");
    const workflowSection = document.createElement("section");
    workflowSection.dataset.promptDepthSection = "workflow";
    workflowSection.innerHTML = '<div data-menu-section-label="true" data-prompt-depth-heading>工作流完整度</div><div data-prompt-depth-options></div>';
    const workflowOptions = workflowSection.querySelector("[data-prompt-depth-options]");
    for (const mode of PROMPT_DEPTH_VALUES) {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "no-drag outline-hidden flex min-h-[var(--menu-item-height,0px)] shrink-0 items-center justify-center rounded-xl p-[var(--menu-item-padding,var(--padding-row-y)_var(--padding-row-x))] text-sm text-default group hover:bg-primary-ghost-hover focus:bg-primary-ghost-hover cursor-interaction flex-row";
      option.dataset.promptDepthOption = mode;
      option.setAttribute("role", "menuitemradio");
      option.setAttribute("aria-checked", "false");
      option.innerHTML = `<span class="flex min-w-0 flex-1 justify-center"><span data-prompt-depth-label class="min-w-0 truncate"></span></span>`;
      option.querySelector("[data-prompt-depth-label]").textContent = promptDepthButtonLabel(mode);
      option.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setPromptDepth({ workflow: mode });
      };
      workflowOptions.append(option);
    }
    menu.append(workflowSection);
    const complexitySection = document.createElement("section");
    complexitySection.dataset.promptDepthSection = "complexity";
    complexitySection.innerHTML = '<div data-menu-section-label="true" data-prompt-depth-heading>提示词复杂度</div><div data-prompt-complexity-slider><div data-prompt-slider-root><div data-prompt-slider-track><span data-prompt-slider-range></span><span data-prompt-slider-ticks><span data-prompt-slider-tick></span><span data-prompt-slider-tick></span><span data-prompt-slider-tick></span></span><span data-prompt-slider-thumb></span></div><input data-prompt-complexity-range type="range" min="0" max="2" step="1" aria-label="提示词复杂度"></div></div><div data-prompt-complexity-labels><span>低</span><span>中</span><span>高</span></div>';
    const range = complexitySection.querySelector("[data-prompt-complexity-range]");
    range.addEventListener("input", () => {
      const complexity = PROMPT_COMPLEXITY_VALUES[Number(range.value)] || "high";
      setPromptDepth({ complexity });
    });
    range.addEventListener("pointerdown", (event) => event.stopPropagation());
    menu.append(complexitySection);
    document.body.append(menu);
    return menu;
  }

  function openPromptDepthMenu(trigger) {
    const menu = ensurePromptDepthMenu();
    if (promptDepthMenuTrigger === trigger && !menu.hidden) {
      positionPromptDepthMenu();
      return;
    }
    closePromptDepthMenu();
    promptDepthMenuTrigger = trigger;
    const value = promptDepthForThread();
    syncPromptDepthMenuOptions(value);
    menu.hidden = false;
    menu.dataset.openThreadId = promptDepthThreadId();
    trigger.setAttribute("aria-expanded", "true");
    trigger.dataset.state = "open";
    const onPointerDown = (event) => {
      if (event.target instanceof Node && (menu.contains(event.target) || trigger.contains(event.target))) return;
      closePromptDepthMenu();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        return;
      }
      const options = [...menu.querySelectorAll("[data-prompt-depth-option]")];
      if (!options.length) return;
      const index = options.indexOf(document.activeElement);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        options[(index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length].focus();
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        options[event.key === "Home" ? 0 : options.length - 1].focus();
      }
    };
    const onViewportChange = () => positionPromptDepthMenu();
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    addEventListener("resize", onViewportChange);
    addEventListener("scroll", onViewportChange, true);
    promptDepthMenuCleanup = () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      removeEventListener("resize", onViewportChange);
      removeEventListener("scroll", onViewportChange, true);
    };
    const placeMenu = () => {
      if (promptDepthMenuTrigger !== trigger || menu.hidden) return;
      positionPromptDepthMenu();
      menu.querySelector(`[data-prompt-depth-option="${CSS.escape(value.workflow)}"]`)?.focus();
    };
    requestAnimationFrame(placeMenu);
    setTimeout(placeMenu, 0);
  }

  function renderPromptDepthButton(button, nativeButton, value) {
    const mode = value.workflow;
    button.className = nativeButton.className;
    button.innerHTML = nativeButton.innerHTML;
    const fullLabel = button.querySelector('[data-composer-footer-collapse="none"]');
    const compactLabel = button.querySelector('[data-composer-footer-collapse="sm"]');
    if (fullLabel) fullLabel.textContent = promptDepthButtonLabel(mode);
    if (compactLabel) compactLabel.textContent = promptDepthButtonLabel(mode);
    if (!fullLabel && !compactLabel) button.textContent = promptDepthButtonLabel(mode);
    button.setAttribute("aria-label", `拆提示词模式：${promptDepthButtonLabel(mode)}`);
    button.title = `工作流完整度：${promptDepthButtonLabel(mode)}`;
    button.dataset.promptDepthMode = mode;
    button.setAttribute("aria-expanded", String(promptDepthMenuTrigger === button));
    button.dataset.state = promptDepthMenuTrigger === button ? "open" : "closed";
  }

  function ensurePromptDepthControl() {
    // Existing conversations expose a dedicated intelligence trigger. The
    // home composer does not, so use its model/reasoning button as the stable
    // footer anchor (visible labels vary by locale/model).
    const composerRoot = document.querySelector(
      '[data-codex-composer-root][data-composer-placement="thread"], [data-codex-composer-root][data-composer-placement="home"]',
    );
    let nativeButton = document.querySelector('[data-codex-intelligence-trigger="true"]')
      || [...(composerRoot?.querySelectorAll("button, [role=button]") || [])].find((candidate) => {
        const label = `${candidate.getAttribute("aria-label") || ""} ${candidate.textContent || ""}`;
        return /Astra|极高|高|high|reason/i.test(label);
      });
    if (!nativeButton && composerRoot) {
      nativeButton = document.createElement("button");
      nativeButton.type = "button";
      nativeButton.className = "codex-prompt-depth-anchor";
      nativeButton.textContent = "6 Astra";
      nativeButton.style.cssText = "position:absolute;right:72px;bottom:10px;opacity:0;pointer-events:none;";
      composerRoot.style.position ||= "relative";
      composerRoot.append(nativeButton);
    }
    const customButton = document.querySelector(`[${PROMPT_DEPTH_TRIGGER_ATTR}="true"]`);
    if (!(nativeButton instanceof HTMLButtonElement)
      || !nativeButton.closest('[data-codex-composer-root][data-composer-placement="thread"], [data-codex-composer-root][data-composer-placement="home"]')) {
      closePromptDepthMenu();
      customButton?.closest("[data-codex-prompt-depth-wrapper]")?.remove();
      document.documentElement.removeAttribute("data-codex-prompt-split-mode");
      return;
    }
    let nativeBoundary = nativeButton.parentElement?.parentElement;
    let controlGroup = nativeBoundary?.parentElement;
    if (nativeButton.classList.contains("codex-prompt-depth-anchor")) {
      nativeBoundary = nativeButton.parentElement;
      controlGroup = nativeBoundary;
    }
    if (!(nativeBoundary instanceof HTMLElement) || !(controlGroup instanceof HTMLElement)
      || !controlGroup.contains(nativeButton)) return;
    let wrapper = customButton?.closest("[data-codex-prompt-depth-wrapper]");
    if (!wrapper || wrapper.parentElement !== controlGroup) {
      wrapper?.remove();
      wrapper = document.createElement("span");
      wrapper.className = "outline-hidden cursor-interaction";
      wrapper.dataset.codexPromptDepthWrapper = "true";
      wrapper.style.cssText = "display:inline-flex;position:relative;z-index:2;pointer-events:auto;min-width:0;";
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute(PROMPT_DEPTH_TRIGGER_ATTR, "true");
      button.setAttribute("aria-haspopup", "menu");
      button.style.cssText = "pointer-events:auto;touch-action:manipulation;min-width:0;cursor:pointer;";
      let pointerToggleAt = 0;
      const togglePromptDepthMenu = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const menu = document.getElementById(PROMPT_DEPTH_MENU_ID);
        if (promptDepthMenuTrigger === button && menu && !menu.hidden) closePromptDepthMenu();
        else openPromptDepthMenu(button);
      };
      // Pointer down is the stable interaction boundary for the native
      // composer footer. A re-render between pointerdown and click can
      // otherwise drop the click entirely; keyboard activation still uses
      // click (detail === 0).
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        pointerToggleAt = Date.now();
        togglePromptDepthMenu(event);
      }, true);
      button.addEventListener("click", (event) => {
        if (Date.now() - pointerToggleAt < 600) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        togglePromptDepthMenu(event);
      }, true);
      wrapper.append(button);
      controlGroup.insertBefore(wrapper, nativeBoundary);
    }
    const button = wrapper.querySelector(`[${PROMPT_DEPTH_TRIGGER_ATTR}="true"]`);
    if (!(button instanceof HTMLButtonElement)) return;
    button.setAttribute("aria-controls", PROMPT_DEPTH_MENU_ID);
    const value = promptDepthForThread();
    renderPromptDepthButton(button, nativeButton, value);
    document.documentElement.setAttribute("data-codex-prompt-split-mode", value.workflow);
    document.documentElement.setAttribute("data-codex-prompt-complexity", value.complexity);
    syncPromptDepthMenuOptions(value);
  }

  function setPromptDepth(next = {}) {
    const threadId = promptDepthThreadId();
    if (!threadId) return;
    const current = promptDepthForThread(threadId);
    const value = {
      workflow: PROMPT_DEPTH_VALUES.includes(next.workflow) ? next.workflow : current.workflow,
      complexity: PROMPT_COMPLEXITY_VALUES.includes(next.complexity) ? next.complexity : current.complexity,
    };
    promptDepthByThread.set(threadId, value);
    persistPromptDepths();
    ensurePromptDepthControl();
    const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    try {
      if (typeof window.codexSidebarPromptDepth === "function") {
        window.codexSidebarPromptDepth(JSON.stringify({ threadId, mode: value.workflow, complexity: value.complexity, requestId }));
      }
    } catch {}
  }

  function navigateToCodexThread(threadId) {
    const route = homeProjectRoute(normalizedThreadId(threadId));
    if (route) {
      window.postMessage({ type: "navigate-to-route", path: route }, "*");
      return true;
    }
    return false;
  }
  function readTaskColdArchive(threadId) {
    try {
      const paths = JSON.parse(localStorage.getItem("codex-workspace-enhancer:task-cold-archives-v1") || "{}");
      const path = Object.hasOwn(paths, threadId) ? paths[threadId] : "";
      return typeof path === "string" && isAbsoluteWindowsAssetPath(path) ? path : "";
    } catch { return ""; }
  }

  function saveTaskColdArchive(threadId, path) {
    if (!threadId || (path && (!isAbsoluteWindowsAssetPath(path) || path.length > 4096))) throw new Error("请填写完整的冷档案文件夹路径。");
    const paths = JSON.parse(localStorage.getItem("codex-workspace-enhancer:task-cold-archives-v1") || "{}");
    if (path) paths[threadId] = path;
    else delete paths[threadId];
    localStorage.setItem("codex-workspace-enhancer:task-cold-archives-v1", JSON.stringify(paths));
  }

  function coldHistoryRequest(path, keyword) {
    if (!isAbsoluteWindowsAssetPath(path) || !keyword.trim()) return "";
    return `请用 codex-thread-cold-history 按需检索此冷档案：${JSON.stringify(path)}。关键词：${JSON.stringify(keyword.trim().slice(0, 160))}。只查少量相关命中，保留记录号、时间与角色，不加载全部历史，不修改档案。`;
  }

  function createTaskColdSection() {
    const section = document.createElement("section");
    section.className = "codex-task-resources";
    section.setAttribute("data-codex-task-cold", "");
    section.dataset.resourceKind = "history";
    section.innerHTML = `<details data-task-cold>
        <summary>冷历史 <span data-task-cold-state></span></summary>
        <p class="codex-task-hint">原文默认不加载，按关键词查找。</p>
        <div data-task-linked-resources hidden>
          <ul data-task-linked-list></ul>
          <p class="codex-task-hint" role="status" data-task-linked-status></p>
        </div>
        <form data-task-cold-query>
          <label>查找旧记录<input name="keyword" placeholder="输入 1–2 个关键词" maxlength="160" required></label>
          <button type="submit">写入查档请求</button>
          <p class="codex-task-hint">添加到输入框，由你发送。</p>
        </form>
        <details><summary>关联冷档案</summary>
          <form data-task-cold-binding>
            <label>档案文件夹<input name="path" placeholder="完整的本机文件夹路径" maxlength="4096" autocomplete="off"></label>
            <button type="submit">保存关联</button>
          </form>
        </details>
        <p role="status" data-task-cold-status></p>
      </details>`;
    const status = section.querySelector("[data-task-cold-status]");
    const active = () => section.dataset.threadId === currentConversationThreadId();
    section.querySelector("[data-task-cold-binding]").onsubmit = (event) => {
      event.preventDefault();
      if (!active()) return;
      try {
        saveTaskColdArchive(section.dataset.threadId, event.currentTarget.elements.path.value.trim());
        section.dataset.coldPath = "";
        renderTaskColdSection(section, section.taskResourcesSnapshot || { threadId: section.dataset.threadId });
        status.textContent = "关联已保存；未读取历史原文。";
      } catch (error) { status.textContent = error.message || "未能保存关联，请重试。"; }
    };
    section.querySelector("[data-task-cold-query]").onsubmit = (event) => {
      event.preventDefault();
      if (!active()) return;
      const request = coldHistoryRequest(readTaskColdArchive(section.dataset.threadId), event.currentTarget.elements.keyword.value);
      if (!request) { status.textContent = "请先关联冷档案，并填写关键词。"; return; }
      status.textContent = addTextToComposer(request) ? "查档请求已放入输入框，尚未发送。" : "输入框暂不可用，请稍后重试。";
    };
    return section;
  }

  function renderTaskColdSection(section, snapshot) {
    const changed = section.dataset.threadId !== snapshot.threadId;
    section.dataset.threadId = snapshot.threadId;
    section.taskResourcesSnapshot = snapshot;
    renderTaskLinkedResources(section, snapshot);
    const path = readTaskColdArchive(snapshot.threadId);
    if (changed || section.dataset.coldPath !== path) {
      section.dataset.coldPath = path;
      section.querySelector("[data-task-cold-binding]").elements.path.value = path;
      section.querySelector("[data-task-cold-query]").hidden = !path;
      section.querySelector("[data-task-cold-state]").textContent = path ? "已关联" : "未关联";
    }
    if (changed) {
      section.querySelector("[data-task-cold-query]").reset();
      section.querySelector("[data-task-cold-status]").textContent = "";
      section.querySelector("[data-task-cold]").open = false;
    }
  }

  function taskResourceReferenceRequest(reference) {
    if (reference?.kind === "history" && isAbsoluteWindowsAssetPath(reference.archivePath)) {
      const lookup = Number.isSafeInteger(reference.recordId) && reference.recordId >= 0
        ? `只查看记录 ${reference.recordId}` : "按 1–2 个关键词检索少量相关记录；请先向我确认关键词";
      return `请用 codex-thread-cold-history 查此冷档案：${JSON.stringify(reference.archivePath)}；${lookup}。保留记录号、时间与角色，不加载全部历史，不修改档案。`;
    }
    if (reference?.kind === "asset" && isAbsoluteWindowsAssetPath(reference.path)) {
      const ticket = reference.ticketId ? `\n票据 ID：${reference.ticketId}` : "";
      const output = reference.outputId ? `\n输出 ID：${reference.outputId}` : "";
      return `引用资产：\n${reference.path}${ticket}${output}`;
    }
    return "";
  }

  function decorateTaskResourceButton(button, label, action, path, history = false) {
    const kind = document.createElement("span");
    kind.className = "codex-task-resource-kind";
    kind.textContent = history ? "记录" : (String(path || "").match(/\.([a-z0-9]{1,5})$/i)?.[1]?.toUpperCase() || "图片");
    const copy = document.createElement("span");
    copy.className = "codex-task-resource-copy";
    const title = document.createElement("strong");
    title.textContent = label;
    const detail = document.createElement("small");
    detail.textContent = action;
    copy.append(title, detail);
    button.append(kind, copy);
  }

  function renderTaskLinkedResources(section, snapshot) {
    const threadId = normalizedThreadId(snapshot.threadId);
    const context = taskContextForSnapshot(snapshot);
    const kind = section.dataset.resourceKind || "asset";
    const references = Array.isArray(context?.references) ? context.references.filter((item) => item.kind === kind && taskResourceReferenceRequest(item)) : [];
    if (kind === "asset") {
      const binding = context?.assetBinding;
      section.querySelector("[data-task-asset-binding]").textContent = context
        ? context.referenceStatus?.includes("项目绑定读取失败") ? "项目绑定暂不可读" : binding?.projectId ? `已绑定项目：${binding.projectName || binding.projectId}` : "未绑定项目资产"
        : "跟随当前任务的项目绑定";
      const health = section.querySelector("[data-task-reference-health]");
      health.textContent = context?.referenceStatus || "";
      health.hidden = !health.textContent;
    }
    section.querySelector("[data-task-linked-resources]").hidden = references.length === 0;
    const signature = JSON.stringify([threadId, references]);
    if (section.dataset.linkedSignature === signature) return;
    section.dataset.linkedSignature = signature;
    const status = section.querySelector("[data-task-linked-status]");
    status.textContent = "";
    section.querySelector("[data-task-linked-list]").replaceChildren(...references.map((reference) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      decorateTaskResourceButton(button, reference.label || (reference.kind === "history" ? "冷历史记录" : "资产引用"), reference.kind === "history" ? "引用旧记录" : "引用此资产", reference.path, reference.kind === "history");
      button.title = `${reference.archivePath || reference.path} · 添加到输入框，不发送`;
      button.onclick = () => {
        if (normalizedThreadId(currentConversationThreadId()) !== threadId || normalizedThreadId(section.dataset.threadId) !== threadId) return;
        const current = taskContextForSnapshot(section.taskResourcesSnapshot);
        if (!current || !Array.isArray(current.references) || !current.references.some((item) => JSON.stringify(item) === JSON.stringify(reference))) return;
        status.textContent = addTextToComposer(taskResourceReferenceRequest(reference))
          ? "引用已放入输入框，尚未发送。" : "输入框暂不可用，请稍后重试。";
      };
      item.append(button);
      return item;
    }));
  }

  function taskOverviewPresentation(snapshot) {
    const nextStep = cleanTaskPreviewText(snapshot.nextStep);
    return {
      summary: cleanTaskPreviewText(snapshot.latestAnswer || snapshot.progress || snapshot.summary) || "尚无答复摘录",
      summaryLabel: snapshot.latestAnswer ? "最近答复摘录" : "近期答复摘录",
      nextStep: /^(?:等待你的下一条要求|等待下一条要求|完成当前要求[：:]|继续处理当前要求[：:])/u.test(nextStep) ? "" : nextStep,
      status: snapshot.running ? "进行中" : snapshot.status === "待继续" ? "待继续" : "空闲",
    };
  }

  function applyOverviewVisibility(rail) {
    const collapsed = isTaskShell() && overviewCollapsed;
    rail.dataset.collapsed = String(collapsed);
    for (const button of rail.querySelectorAll("[data-codex-thread-overview-collapse], [data-codex-thread-overview-expand]")) {
      if (button.getAttribute("aria-expanded") !== String(!collapsed)) button.setAttribute("aria-expanded", String(!collapsed));
    }
  }

  function toggleThreadOverview() {
    overviewCollapsed = !overviewCollapsed;
    try { localStorage.setItem(OVERVIEW_COLLAPSED_KEY, String(overviewCollapsed)); } catch {}
    const rail = document.getElementById(THREAD_OVERVIEW_RAIL_ID);
    if (!rail) return;
    applyOverviewVisibility(rail);
    rail.querySelector(overviewCollapsed ? "[data-codex-thread-overview-expand]" : "[data-codex-thread-overview-collapse]").focus();
  }

  function readTaskNotesStore() {
    const value = JSON.parse(localStorage.getItem("codex-workspace-enhancer:task-notes-v1") || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("笔记格式无效");
    return value;
  }

  function taskContextForSnapshot(snapshot) {
    const normalize = (id) => String(id || "").replace(/^(?:local|cloud):/iu, "").toLowerCase();
    const context = snapshot?.taskContext;
    const id = normalize(snapshot?.threadId);
    return id && context && normalize(context.threadId) === id ? context : null;
  }

  function taskSkillRequest(entry) {
    return entry;
  }

  function taskSkillComposerController() {
    const editor = document.querySelector('[data-composer-placement="thread"] [contenteditable="true"]');
    for (let element = editor; element; element = element.parentElement) {
      const key = Object.keys(element).find((key) => key.startsWith("__reactFiber$"));
      if (!key) continue;
      for (let fiber = element[key]; fiber; fiber = fiber.return) {
        const controller = fiber.memoizedProps?.composerController;
        if (controller?.view?.dom === editor && controller.view.state?.schema?.nodes?.skillMention) return controller;
      }
      break;
    }
    return null;
  }

  function taskComposerSkills(controller) {
    const entries = [];
    controller?.view.state.doc.descendants((node, pos) => {
      if (node.type.name === "skillMention" && node.attrs.path) entries.push({ ...node.attrs, pos, nodeSize: node.nodeSize });
    });
    return entries;
  }

  function addNativeTaskSkill(entry) {
    const controller = taskSkillComposerController();
    if (!controller || !entry?.path || !entry.name || entry.enabled === false) return false;
    if (taskComposerSkills(controller).some((item) => item.path === entry.path)) return true;
    const { state } = controller.view;
    const type = state.schema.nodes.skillMention;
    const mention = type.create({ name: entry.name, displayName: entry.title || entry.name, path: entry.path, description: entry.description || "" });
    let position = null;
    state.doc.descendants((node, pos) => {
      if (position === null && node.isTextblock && node.type.contentMatch.matchType(type)) position = pos + 1;
      return position === null;
    });
    const transaction = position === null
      ? state.tr.insert(state.doc.content.size, state.schema.nodes.paragraph.create(null, mention))
      : state.tr.insert(position, mention);
    controller.view.dispatch(transaction);
    ensureTaskSkillComposerChips();
    return true;
  }

  function removeNativeTaskSkill(path, threadId) {
    if (normalizedThreadId(currentConversationThreadId()) !== normalizedThreadId(threadId)) return;
    const controller = taskSkillComposerController();
    if (!controller) return;
    const entries = taskComposerSkills(controller).filter((entry) => entry.path === path);
    if (!entries.length) return;
    const transaction = controller.view.state.tr;
    for (const entry of entries.reverse()) transaction.delete(entry.pos, entry.pos + entry.nodeSize);
    controller.view.dispatch(transaction);
    ensureTaskSkillComposerChips();
  }

  function ensureTaskSkillComposerChips() {
    const id = "codex-task-skill-composer-chips";
    const portal = document.querySelector('[data-codex-composer-root][data-composer-placement="thread"] > [data-above-composer-portal="true"]');
    const entries = taskComposerSkills(taskSkillComposerController());
    let container = document.getElementById(id);
    if (!isTaskShell() || !portal || !entries.length) {
      if (container && !entries.length) {
        const status = document.querySelector("[data-task-skill-status]");
        if (status?.textContent.startsWith("已选中技能")) status.textContent = "选中后显示在输入框上方，随消息使用。";
      }
      container?.remove();
      return;
    }
    if (!container || container.parentElement !== portal) {
      container?.remove();
      container = document.createElement("div");
      container.id = id;
      container.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;padding:6px 12px";
      portal.append(container);
    }
    const threadId = currentConversationThreadId();
    const unique = [...new Map(entries.map((entry) => [entry.path, entry])).values()];
    const signature = JSON.stringify([threadId, unique.map((entry) => [entry.path, entry.displayName, entry.name])]);
    if (container.skillSignature === signature) return;
    container.skillSignature = signature;
    container.replaceChildren();
    const style = document.createElement("style");
    style.textContent = '[data-composer-placement="thread"] [contenteditable="true"] [skill-mention-path]{display:none!important}';
    container.append(style);
    for (const entry of unique) {
      const chip = document.createElement("span");
      chip.style.cssText = "display:inline-flex;align-items:center;gap:7px;max-width:100%;border:1px solid var(--border-default,#8885);border-radius:8px;padding:3px 7px;font-size:12px";
      const label = document.createElement("span");
      label.textContent = entry.displayName || entry.name;
      label.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      chip.title = entry.path;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `移除技能：${label.textContent}`);
      remove.onclick = () => removeNativeTaskSkill(entry.path, threadId);
      chip.append(label, remove);
      container.append(chip);
    }
  }

  function createTaskSkillsSection() {
    const section = document.createElement("section");
    section.setAttribute("data-codex-task-skills", "");
    section.innerHTML = `
      <div class="codex-task-skills-heading"><h3>默认执行</h3><button type="button" data-task-skill-default-add aria-pressed="false">添加/删除</button></div>
      <p data-task-skill-default-hint>仅此任务 · 启用摘要提醒后，从下一条消息提醒读取</p>
      <div data-task-skill-defaults class="codex-task-skill-defaults"></div>
      <div class="codex-task-skills-heading"><h3>Skill 管理</h3><button type="button" data-task-skill-refresh>刷新</button></div>
      <input type="search" data-task-skill-search aria-label="搜索技能" placeholder="搜索所有技能" autocomplete="off">
      <div class="codex-task-skill-filters">
        ${SKILL_FILTERS.map((filter) => `<button type="button" data-task-skill-filter="${escapeSkillLabel(filter)}" aria-pressed="${filter === "常用"}">${escapeSkillLabel(filter)}</button>`).join("")}
      </div>
      <div class="codex-task-skill-summary"><p data-task-skill-status role="status">选中后显示在输入框上方，随消息使用。</p><span data-task-skill-count></span></div>
      <div data-task-skill-list></div>`;
    section.skillFilter = "常用";
    section.querySelector("[data-task-skill-default-add]").onclick = () => {
      if (section.defaultsPending) return;
      section.pickingDefaults = !section.pickingDefaults;
      section.querySelector("[data-task-skill-status]").textContent = section.pickingDefaults
        ? "上方删除默认项，下方搜索或按分类添加。" : "选中后显示在输入框上方，随消息使用。";
      renderTaskSkillsSection(section, section.skillsSnapshot);
      if (section.pickingDefaults) section.querySelector("[data-task-skill-search]").focus();
    };
    section.querySelector("[data-task-skill-search]").oninput = () => renderTaskSkillList(section);
    section.querySelectorAll("[data-task-skill-filter]").forEach((button) => {
      button.onclick = () => {
        section.skillFilter = button.dataset.taskSkillFilter;
        renderTaskSkillList(section);
      };
    });
    section.querySelector("[data-task-skill-refresh]").onclick = () => {
      section.querySelector("[data-task-skill-status]").textContent = "正在刷新技能目录…";
      requestTaskSkillCatalog(true);
    };
    return section;
  }

  function addTaskSkillRequest(section, threadId, text) {
    if (!section.isConnected || normalizedThreadId(currentConversationThreadId()) !== normalizedThreadId(threadId)) return;
    section.querySelector("[data-task-skill-status]").textContent = addNativeTaskSkill(text)
      ? "已选中技能，随你的下一条消息使用。" : "当前输入框暂不支持技能附件。";
  }

  function changeTaskSkillDefault(section, threadId, action, entry, value) {
    if (!section.isConnected || section.defaultsPending || section.threadId !== threadId
      || normalizedThreadId(currentConversationThreadId()) !== threadId) return;
    if (action === "add" && (!entry || entry.enabled === false || !taskSkillCatalog?.entries.includes(entry))) return;
    const status = section.querySelector("[data-task-skill-status]");
    if (typeof window.codexSidebarDefaultSkills !== "function") {
      status.textContent = "默认设置暂不可用，请稍后重试。";
      return;
    }
    const requestId = crypto.randomUUID();
    section.defaultsPending = requestId;
    status.textContent = "正在保存默认设置…";
    renderTaskSkillsSection(section, section.skillsSnapshot);
    section.defaultsTimer = setTimeout(() => setSkillDefaults({ threadId, requestId, error: "保存未确认，请刷新后重试。" }), 10_000);
    try { window.codexSidebarDefaultSkills(JSON.stringify({ threadId, requestId, action, entry, value })); }
    catch { setSkillDefaults({ threadId, requestId, error: "默认设置保存失败，请稍后重试。" }); }
  }

  function setSkillDefaults(result) {
    const section = document.querySelector("[data-codex-task-skills]");
    if (!section || section.defaultsPending !== result.requestId || section.threadId !== result.threadId
      || normalizedThreadId(currentConversationThreadId()) !== result.threadId) return;
    clearTimeout(section.defaultsTimer);
    section.defaultsPending = null;
    if (!result.error && result.data?.threadId === result.threadId && Array.isArray(result.data.agreements)) {
      section.skillsSnapshot = { ...section.skillsSnapshot, taskContext: { ...section.skillsSnapshot.taskContext, ...result.data } };
      if (normalizedThreadId(threadOverview?.threadId) === result.threadId) threadOverview = { ...threadOverview, taskContext: section.skillsSnapshot.taskContext };
    }
    renderTaskSkillsSection(section, section.skillsSnapshot);
    section.querySelector("[data-task-skill-status]").textContent = result.error || "已保存；启用摘要提醒后，从下一条消息提醒读取。";
  }


  function renderTaskSkillList(section) {
    const entries = taskSkillCatalog?.entries || [];
    const favorites = entries.length ? loadSkillFavorites(entries) : new Set();
    const query = normalizedSkillText(section.querySelector("[data-task-skill-search]").value);
    const signature = JSON.stringify([section.threadId, section.skillFilter, query, [...favorites], section.pickingDefaults, section.defaultsSignature]);
    if (section.skillListSignature === signature && section.skillListCatalog === taskSkillCatalog) return;
    section.skillListSignature = signature;
    section.skillListCatalog = taskSkillCatalog;
    const visible = entries.filter((entry) => {
      const description = SKILL_DESCRIPTION_OVERRIDES.get(entry.title) || entry.description;
      return query ? normalizedSkillText(`${entry.title} ${entry.name} ${description}`).includes(query)
        : skillCategoryMatches(entry, section.skillFilter);
    });
    section.querySelectorAll("[data-task-skill-filter]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.taskSkillFilter === section.skillFilter));
    });
    section.querySelector("[data-task-skill-count]").textContent = `${visible.length} / ${entries.length}`;
    const list = section.querySelector("[data-task-skill-list]");
    list.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.textContent = !taskSkillCatalog ? "正在读取技能目录…" : taskSkillCatalog.error || (query ? "没有匹配的技能。" : section.skillFilter === "常用" ? "暂无常用技能，在全部中点 ☆ 收藏。" : "此分类暂无技能。");
      list.append(empty);
    }
    const threadId = section.threadId;
    const groups = query ? [] : groupedSkillEntries(visible, section.skillFilter);
    const containers = new Map();
    for (const group of groups) {
      const container = document.createElement("details");
      container.className = "codex-task-skill-group";
      container.open = true;
      const heading = document.createElement("summary");
      heading.textContent = `${group.label} · ${group.entries.length}`;
      container.append(heading);
      for (const entry of group.entries) containers.set(entry, container);
      list.append(container);
    }
    for (const entry of visible) {
      const row = document.createElement("div");
      row.className = "codex-task-skill-row";
      const invoke = document.createElement("button");
      invoke.type = "button";
      invoke.className = "codex-task-skill-invoke";
      const isDefault = section.skillDefaults?.some((value) => value.includes(`（${entry.name}）`));
      invoke.disabled = entry.enabled === false || Boolean(section.pickingDefaults && (section.defaultsPending || isDefault));
      invoke.title = entry.enabled === false ? "此技能已停用" : section.pickingDefaults ? (isDefault ? "已加入默认" : "加入默认") : "选择技能";
      invoke.setAttribute("aria-label", `${invoke.title}：${entry.title}`);
      const title = document.createElement("strong");
      title.textContent = `${section.pickingDefaults ? (isDefault ? "✓ " : "＋ ") : ""}${entry.title}`;
      const description = document.createElement("span");
      description.textContent = SKILL_DESCRIPTION_OVERRIDES.get(entry.title) || entry.description || entry.name;
      invoke.append(title, description);
      const pickingDefaults = section.pickingDefaults;
      invoke.onclick = () => pickingDefaults
        ? changeTaskSkillDefault(section, threadId, "add", entry)
        : addTaskSkillRequest(section, threadId, taskSkillRequest(entry));
      const favorite = document.createElement("button");
      favorite.type = "button";
      favorite.className = "codex-task-skill-star";
      favorite.textContent = favorites.has(entry.title) ? "★" : "☆";
      favorite.setAttribute("aria-label", `${favorites.has(entry.title) ? "取消常用" : "加入常用"}：${entry.title}`);
      favorite.setAttribute("aria-pressed", String(favorites.has(entry.title)));
      favorite.onclick = () => {
        if (favorites.has(entry.title)) favorites.delete(entry.title);
        else favorites.add(entry.title);
        saveSkillFavorites();
        renderTaskSkillList(section);
        skillOrganizerRenderSignature = "";
        renderSkillOrganizer();
      };
      row.append(invoke, favorite);
      (containers.get(entry) || list).append(row);
    }
  }

  function renderTaskSkillsSection(section, snapshot) {
    if (!snapshot) return;
    const threadId = normalizedThreadId(snapshot.threadId);
    if (section.threadId !== threadId) {
      clearTimeout(section.defaultsTimer);
      section.defaultsPending = null;
      section.pickingDefaults = false;
      section.threadId = threadId;
      section.querySelector("[data-task-skill-status]").textContent = "选中后显示在输入框上方，随消息使用。";
    }
    section.skillsSnapshot = snapshot;
    const defaults = taskContextForSnapshot(snapshot)?.agreements.filter((value) => value.startsWith("默认执行 · ")) || [];
    section.skillDefaults = defaults;
    section.dataset.taskDefaultPicker = String(Boolean(section.pickingDefaults));
    const add = section.querySelector("[data-task-skill-default-add]");
    add.textContent = section.pickingDefaults ? "完成" : "添加/删除";
    add.disabled = Boolean(section.defaultsPending);
    add.setAttribute("aria-pressed", String(Boolean(section.pickingDefaults)));
    const signature = JSON.stringify([threadId, defaults, section.defaultsPending, section.pickingDefaults]);
    if (section.defaultsSignature !== signature) {
      section.defaultsSignature = signature;
      const list = section.querySelector("[data-task-skill-defaults]");
      list.replaceChildren();
      for (const value of defaults) {
        const text = value.replace(/^默认执行 · /u, "");
        const chip = document.createElement("span");
        const label = document.createElement("span");
        label.textContent = text.split(/[（：]/u)[0];
        chip.title = text;
        chip.append(label);
        if (section.pickingDefaults) {
          const remove = document.createElement("button");
          remove.type = "button";
          remove.textContent = "删除";
          remove.disabled = Boolean(section.defaultsPending);
          remove.title = "移出此任务默认，不卸载技能";
          remove.setAttribute("aria-label", `移除默认：${label.textContent}`);
          remove.onclick = () => changeTaskSkillDefault(section, threadId, "remove", null, value);
          chip.append(remove);
        }
        list.append(chip);
      }
      if (!defaults.length) list.textContent = "暂无默认项，点“添加/删除”选择技能。";
    }
    requestTaskSkillCatalog();
    renderTaskSkillList(section);
  }

  function setSkillCatalog(value) {
    taskSkillCatalog = value && Array.isArray(value.entries) ? value : { entries: [], error: "技能目录不可用，请刷新。" };
    const section = document.querySelector("[data-codex-task-skills]");
    if (section) {
      if (!section.defaultsPending) section.querySelector("[data-task-skill-status]").textContent = taskSkillCatalog.error || (section.pickingDefaults ? "上方删除默认项，下方搜索或按分类添加。" : "选中后显示在输入框上方，随消息使用。");
      renderTaskSkillList(section);
    }
  }

  function requestTaskSkillCatalog(forceReload = false) {
    const threadId = normalizedThreadId(currentConversationThreadId());
    const cwd = normalizedThreadId(threadOverview?.threadId) === threadId ? threadOverview?.cwd : null;
    const key = threadId && typeof cwd === "string" && cwd ? `${threadId}\n${cwd}` : "";
    if (!forceReload && key && taskSkillCatalogKey === key) return;
    taskSkillRequestCleanup?.();
    taskSkillCatalogKey = key;
    if (!key) {
      setSkillCatalog({ entries: [], error: "正在读取当前任务目录，请稍后刷新。" });
      return;
    }
    const id = `enhancer-skills-${crypto.randomUUID()}`;
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      if (taskSkillRequestCleanup === cleanup) taskSkillRequestCleanup = null;
    };
    const finish = (value) => {
      if (taskSkillRequestCleanup !== cleanup) return;
      cleanup();
      if (destroyed || normalizedThreadId(currentConversationThreadId()) !== threadId
        || threadOverview?.cwd !== cwd) {
        if (taskSkillCatalogKey === key) taskSkillCatalogKey = "";
        return;
      }
      setSkillCatalog(value);
    };
    const onMessage = (event) => {
      const message = event.data;
      if (message?.type !== "mcp-response" || message.hostId !== "local" || message.message?.id !== id) return;
      const response = message.message;
      if (response.error || !Array.isArray(response.result?.data)) {
        finish({ entries: [], error: "技能目录读取失败，请刷新重试。" });
        return;
      }
      const entries = response.result.data.flatMap((group) => (group.skills || []).map((entry) => ({
        name: entry.name,
        title: entry.interface?.displayName || entry.name,
        description: entry.interface?.shortDescription || entry.shortDescription || entry.description || "",
        path: entry.path,
        enabled: entry.enabled !== false,
      })));
      const hasErrors = response.result.data.some((group) => group.errors?.length);
      finish({ entries, ...(hasErrors ? { error: "部分技能未能读取，可刷新重试。" } : {}) });
    };
    taskSkillRequestCleanup = cleanup;
    setSkillCatalog({ entries: [], error: "正在读取技能目录…" });
    window.addEventListener("message", onMessage);
    timer = setTimeout(() => finish({ entries: [], error: "技能目录读取超时，请刷新重试。" }), 15_000);
    try {
      Promise.resolve(window.electronBridge.sendMessageFromView({
        type: "mcp-request",
        hostId: "local",
        request: { id, method: "skills/list", params: { cwds: [cwd], ...(forceReload ? { forceReload: true } : {}) } },
        source: "skills",
        priority: "background",
      })).catch(() => finish({ entries: [], error: "技能目录连接失败，请刷新重试。" }));
    } catch {
      finish({ entries: [], error: "技能目录连接不可用，请刷新重试。" });
    }
  }

  function createTaskAutoContextSection() {
    const section = document.createElement("section");
    section.setAttribute("data-codex-task-auto-context", "");
    for (const [key, label] of [["goal", "当前目标"], ["progress", "最新进展"], ["nextStep", "下一步"]]) {
      const field = document.createElement("section");
      const heading = document.createElement("h3");
      heading.textContent = label;
      const text = document.createElement("p");
      text.setAttribute(`data-codex-task-auto-${key}`, "");
      field.append(heading, text);
      section.append(field);
    }
    const fixed = document.createElement("details");
    const heading = document.createElement("summary");
    heading.textContent = "固定约定";
    const agreements = document.createElement("ul");
    agreements.setAttribute("data-codex-task-auto-agreements", "");
    fixed.append(heading, agreements);
    const updated = document.createElement("p");
    updated.className = "codex-task-hint";
    updated.setAttribute("data-codex-task-auto-updated", "");
    section.append(fixed, updated);
    section.hidden = true;
    return section;
  }

  function renderTaskAutoContextSection(section, snapshot) {
    const context = taskContextForSnapshot(snapshot);
    section.hidden = !context;
    if (!context) return;
    for (const [key, fallback] of [["goal", "尚未记录目标"], ["progress", "尚未记录进展"], ["nextStep", "暂无待办"]]) {
      const node = section.querySelector(`[data-codex-task-auto-${key}]`);
      const value = context[key] || fallback;
      if (node.textContent !== value) node.textContent = value;
    }
    const list = section.querySelector("[data-codex-task-auto-agreements]");
    const values = context.agreements.length ? context.agreements : ["暂无固定约定"];
    const signature = JSON.stringify(values);
    if (section.taskAgreementSignature !== signature) {
      list.replaceChildren(...values.map((value) => {
        const item = document.createElement("li");
        item.textContent = value;
        return item;
      }));
      section.taskAgreementSignature = signature;
    }
    const updated = section.querySelector("[data-codex-task-auto-updated]");
    const label = `随进展更新 · ${new Date(context.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    if (updated.textContent !== label) updated.textContent = label;
  }

  function createTaskNotesSection() {
    const section = document.createElement("section");
    section.className = "codex-task-notes";
    section.setAttribute("data-codex-task-notes", "");
    section.taskNotesDrafts = createTaskNotesSection.drafts ||= new Map();
    const view = document.createElement("div");
    view.setAttribute("data-codex-task-notes-view", "");
    const empty = document.createElement("p");
    empty.className = "codex-task-notes-empty";
    empty.setAttribute("data-codex-task-notes-empty", "");
    empty.textContent = "还没有笔记，可记录已确认结论与下一步。";
    const editor = document.createElement("div");
    editor.setAttribute("data-codex-task-notes-editor", "");
    for (const [key, labelText] of [["conclusion", "已确认结论"], ["nextStep", "下一步"]]) {
      const heading = document.createElement("h3");
      heading.textContent = labelText;
      const text = document.createElement("p");
      text.setAttribute(`data-codex-task-note-${key}`, "");
      view.append(heading, text);
      const label = document.createElement("label");
      label.textContent = labelText;
      const input = document.createElement("textarea");
      input.maxLength = 4000;
      input.rows = 4;
      input.setAttribute(`data-codex-task-note-input-${key}`, "");
      input.oninput = () => {
        const draft = section.taskNotesDrafts.get(section.taskNotesSnapshot?.threadId);
        if (draft) draft[key] = input.value;
      };
      label.appendChild(input);
      editor.appendChild(label);
    }
    const actions = document.createElement("div");
    actions.className = "codex-task-actions";
    for (const [action, label, handler] of [
      ["edit", "编辑笔记", () => editTaskNotes(section, section.taskNotesSnapshot)],
      ["save", "保存", () => saveTaskNotes(section)],
      ["cancel", "取消", () => cancelTaskNotes(section)],
      ["excerpt", "摘录填入草稿", () => {
        const snapshot = section.taskNotesSnapshot;
        editTaskNotes(section, snapshot);
        const draft = section.taskNotesDrafts.get(snapshot?.threadId);
        if (!draft) return;
        const excerpt = cleanTaskPreviewText(snapshot.latestAnswer || snapshot.progress);
        draft.conclusion = [draft.conclusion, excerpt].filter(Boolean).join("\n\n").slice(0, 4000);
        renderTaskNotesSection(section, snapshot);
      }],
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.setAttribute(`data-codex-task-notes-${action}`, "");
      button.onclick = handler;
      actions.appendChild(button);
    }
    const error = document.createElement("p");
    error.setAttribute("data-codex-task-notes-error", "");
    error.setAttribute("role", "alert");
    section.append(empty, view, editor, actions, error);
    renderTaskNotesSection(section, {});
    return section;
  }

  function renderTaskNotesSection(section, snapshot) {
    section.taskNotesSnapshot = snapshot || {};
    const threadId = snapshot?.threadId;
    let saved = {};
    let error = "";
    try { saved = readTaskNotesStore()[threadId] || {}; }
    catch { error = "读取笔记失败，请稍后重试。"; }
    const draft = section.taskNotesDrafts.get(threadId);
    const editing = Boolean(threadId && draft?.editing);
    const hasNotes = Boolean(saved.conclusion?.trim() || saved.nextStep?.trim());
    const view = section.querySelector("[data-codex-task-notes-view]");
    const editor = section.querySelector("[data-codex-task-notes-editor]");
    const empty = section.querySelector("[data-codex-task-notes-empty]");
    const automatic = Boolean(taskContextForSnapshot(snapshot));
    if (empty.hidden !== (editing || hasNotes || automatic)) empty.hidden = editing || hasNotes || automatic;
    const editButton = section.querySelector("[data-codex-task-notes-edit]");
    const editLabel = automatic ? "补充 / 纠正" : "编辑笔记";
    if (editButton.textContent !== editLabel) editButton.textContent = editLabel;
    if (view.hidden !== (editing || !hasNotes)) view.hidden = editing || !hasNotes;
    if (editor.hidden !== !editing) editor.hidden = !editing;
    for (const key of ["conclusion", "nextStep"]) {
      const text = section.querySelector(`[data-codex-task-note-${key}]`);
      const savedText = saved[key] || "暂无";
      const className = saved[key] ? "" : "codex-task-note-empty";
      if (text.textContent !== savedText) text.textContent = savedText;
      if (text.className !== className) text.className = className;
      const input = section.querySelector(`[data-codex-task-note-input-${key}]`);
      const value = (editing ? draft[key] : saved[key]) || "";
      if (input.value !== value) input.value = value;
    }
    for (const action of ["edit", "save", "cancel", "excerpt"]) {
      const button = section.querySelector(`[data-codex-task-notes-${action}]`);
      const hidden = action === "edit" ? editing : !editing;
      if (button.hidden !== hidden) button.hidden = hidden;
      if (button.disabled !== !threadId) button.disabled = !threadId;
    }
    const errorNode = section.querySelector("[data-codex-task-notes-error]");
    const errorText = draft?.error || error;
    if (errorNode.textContent !== errorText) errorNode.textContent = errorText;
  }

  function editTaskNotes(section, snapshot) {
    const threadId = snapshot?.threadId;
    if (!threadId) return;
    let draft = section.taskNotesDrafts.get(threadId);
    if (!draft?.editing) {
      try {
        const saved = readTaskNotesStore()[threadId] || {};
        draft = { conclusion: saved.conclusion || "", nextStep: saved.nextStep || "", editing: true };
      } catch {
        renderTaskNotesSection(section, snapshot);
        return;
      }
      section.taskNotesDrafts.set(threadId, draft);
    }
    renderTaskNotesSection(section, snapshot);
    section.querySelector("[data-codex-task-note-input-conclusion]").focus();
  }

  function saveTaskNotes(section) {
    const snapshot = section.taskNotesSnapshot;
    const draft = section.taskNotesDrafts.get(snapshot?.threadId);
    if (!snapshot?.threadId || !draft?.editing) return;
    try {
      const store = readTaskNotesStore();
      store[snapshot.threadId] = { conclusion: draft.conclusion.slice(0, 4000), nextStep: draft.nextStep.slice(0, 4000) };
      localStorage.setItem("codex-workspace-enhancer:task-notes-v1", JSON.stringify(store));
      section.taskNotesDrafts.delete(snapshot.threadId);
    } catch {
      draft.error = "保存失败，草稿仍保留，请重试。";
    }
    renderTaskNotesSection(section, snapshot);
  }

  function cancelTaskNotes(section) {
    section.taskNotesDrafts.delete(section.taskNotesSnapshot?.threadId);
    renderTaskNotesSection(section, section.taskNotesSnapshot);
    section.querySelector("[data-codex-task-notes-edit]").focus();
  }

  function createTaskExcerptSection() {
    const section = document.createElement("details");
    section.className = "codex-task-excerpt";
    section.setAttribute("data-codex-task-excerpt", "");
    section.taskExcerptStates = createTaskExcerptSection.states ||= new Map();
    const heading = document.createElement("summary");
    heading.setAttribute("data-codex-task-excerpt-label", "");
    const text = document.createElement("p");
    text.setAttribute("data-codex-task-excerpt-text", "");
    section.append(heading, text);
    section.ontoggle = () => {
      if (section.taskExcerptThreadId) section.taskExcerptStates.set(section.taskExcerptThreadId, section.open);
    };
    return section;
  }

  function renderTaskExcerptSection(section, snapshot) {
    if (section.taskExcerptThreadId !== snapshot.threadId) {
      if (section.taskExcerptThreadId) section.taskExcerptStates.set(section.taskExcerptThreadId, section.open);
      section.taskExcerptThreadId = snapshot.threadId;
      section.open = section.taskExcerptStates.get(snapshot.threadId) || false;
    }
    const presentation = taskOverviewPresentation(snapshot);
    for (const [attribute, value] of [["label", presentation.summaryLabel], ["text", presentation.summary]]) {
      const node = section.querySelector(`[data-codex-task-excerpt-${attribute}]`);
      if (node.textContent !== value) node.textContent = value;
    }
  }

  function createThreadOverviewRail() {
    const rail = document.createElement("aside");
    rail.id = THREAD_OVERVIEW_RAIL_ID;
    rail.dataset.codexPreviewRuntime = RUNTIME_TOKEN;
    rail.dataset.overviewLayout = isTaskShell() ? "skill-trace" : "overview";
    rail.setAttribute("aria-label", "当前线程整体概述");
    rail.innerHTML = `
      <button type="button" data-codex-thread-overview-expand aria-label="展开技能调用" aria-controls="codex-company-master-view" title="展开技能调用">‹<span>技能调用</span></button>
      <div id="codex-company-master-view" data-codex-company-master-view>
      <div class="codex-thread-overview-header">
        <span class="codex-thread-overview-mark" aria-hidden="true"></span>
        <h2 data-codex-thread-overview-heading>线程概述</h2>
        <span data-codex-thread-overview-status></span>
        <button type="button" data-codex-thread-overview-collapse aria-label="收起技能调用" aria-controls="codex-company-master-view" title="收起技能调用">›</button>
      </div>
      <div class="codex-thread-overview-body" aria-live="polite">
        <p class="codex-thread-overview-title" data-codex-thread-overview-title></p>
        <div data-codex-task-context-extras></div>
        <section class="codex-thread-overview-card" data-codex-thread-default-summary>
          <span class="codex-thread-overview-label" data-codex-thread-summary-label>总结</span>
          <p data-codex-thread-overview-summary></p>
        </section>
        <section class="codex-thread-overview-card" data-kind="next" data-codex-thread-default-summary>
          <span class="codex-thread-overview-label" data-codex-thread-next-label>接下来</span>
          <p data-codex-thread-overview-next></p>
        </section>
        <section class="codex-thread-overview-card codex-thread-master-current" data-codex-thread-master-only data-codex-thread-master-current>
          <span class="codex-thread-overview-label">主控进展</span>
          <div data-codex-thread-master-current-content></div>
        </section>
        <section class="codex-thread-overview-card" data-codex-thread-master-only>
          <span class="codex-thread-overview-label">关键时间</span>
          <ul class="codex-thread-master-time-list" data-codex-thread-master-time-list></ul>
          <p data-codex-thread-master-time-empty>暂无带明确时间的信息</p>
        </section>
        <details class="codex-thread-master-summary" data-codex-thread-master-only>
          <summary>查看线程总结</summary>
          <p data-codex-thread-master-summary></p>
        </details>
        <span data-codex-thread-overview-meta></span>
      </div>
      <button type="button" data-codex-thread-add-memo>加入未完成工作</button>
      </div>
      `;
    if (isTaskShell()) {
      rail.querySelectorAll([
        "[data-codex-task-context-extras]",
        "[data-codex-thread-default-summary]",
        "[data-codex-thread-master-only]",
        "[data-codex-thread-overview-meta]",
        "[data-codex-thread-add-memo]",
      ].join(",")).forEach((node) => node.remove());
    }
    const body = rail.querySelector(".codex-thread-overview-body");
    if (isTaskShell()) body.append(createTaskPromptStatusSection(), createTaskSkillTraceSection());
    const contextExtras = rail.querySelector("[data-codex-task-context-extras]");
    if (contextExtras) contextExtras.append(createTaskAutoContextSection(), createTaskNotesSection(), createTaskColdSection(), createTaskExcerptSection());
    const memoButton = rail.querySelector("[data-codex-thread-add-memo]");
    if (memoButton) {
      memoButton.onclick = () => {
        if (isTaskShell()) editTaskNotes(rail.querySelector("[data-codex-task-notes]"), resolvedCurrentThreadSnapshot());
      };
    }
    rail.querySelector("[data-codex-thread-overview-expand]").onclick = toggleThreadOverview;
    rail.querySelector("[data-codex-thread-overview-collapse]").onclick = toggleThreadOverview;
    rail.querySelectorAll("[data-codex-company-workstream]").forEach((button) => {
      button.onclick = () => openCompanyOperations(button.dataset.codexCompanyWorkstream);
    });
    return rail;
  }

  function renderThreadOverviewRail(rail, snapshot) {
    const companyMode = document.documentElement.getAttribute(COMPANY_WORKBENCH_MODE_ATTR) === "true";
    const taskShell = isTaskShell();
    const presentation = taskShell ? taskOverviewPresentation(snapshot) : snapshot;
    applyOverviewVisibility(rail);
    if (taskShell) taskRailTab = "skills";
    rail.dataset.taskPane = "context";
    const tabs = rail.querySelector("[data-codex-task-rail-tabs]");
    if (tabs) tabs.hidden = !taskShell;
    rail.querySelectorAll("[data-task-rail-tab]").forEach((button) => button.setAttribute("aria-pressed", String(taskShell ? button.dataset.taskRailTab === "skills" : button.dataset.taskRailTab === taskRailTab)));
    const promptStatus = rail.querySelector("[data-codex-task-prompt-status]");
    if (promptStatus) renderTaskPromptStatusSection(promptStatus, snapshot);
    const skills = rail.querySelector("[data-codex-task-skill-trace]");
    if (skills) {
      skills.hidden = !taskShell;
      if (!skills.hidden) renderTaskSkillTraceSection(skills, skillTrace);
    }
    if (taskShell) {
      rail.querySelector("[data-codex-thread-overview-title]").textContent = snapshot.title || "当前 Codex 任务";
      rail.querySelector("[data-codex-thread-overview-heading]").textContent = "技能活动";
      const status = rail.querySelector("[data-codex-thread-overview-status]");
      status.textContent = skillTrace?.status === "failed" ? "存在失败" : skillTrace?.status === "running" ? "执行中" : presentation.status || "已同步";
      status.dataset.running = String(skillTrace?.status === "running" || snapshot.running);
      return;
    }
    if (taskShell) {
      renderTaskAutoContextSection(rail.querySelector("[data-codex-task-auto-context]"), snapshot);
      renderTaskNotesSection(rail.querySelector("[data-codex-task-notes]"), snapshot);
      renderTaskColdSection(rail.querySelector("[data-codex-task-cold]"), snapshot);
      renderTaskExcerptSection(rail.querySelector("[data-codex-task-excerpt]"), snapshot);
    }
    const timeItems = [];
    const signature = [
      companyMode,
      taskShell,
      snapshot.latestAnswer,
      snapshot.threadId,
      snapshot.title,
      snapshot.currentRequest,
      snapshot.progress,
      snapshot.summary,
      snapshot.nextStep,
      snapshot.status,
      snapshot.turnCount,
      snapshot.historyComplete,
      JSON.stringify(snapshot.taskContext),
      timeItems.map((item) => [item.id, item.title, item.detail].join("\u0001")).join("\u0002"),
    ].join("\u0000");
    if (rail.dataset.signature === signature) return;
    rail.dataset.signature = signature;
    rail.querySelector("[data-codex-thread-overview-title]").textContent = snapshot.title;
    rail.querySelector("[data-codex-thread-overview-summary]").textContent = presentation.summary;
    rail.querySelector("[data-codex-thread-summary-label]").textContent = taskShell ? presentation.summaryLabel : "总结";
    rail.querySelector("[data-codex-thread-next-label]").textContent = taskShell ? "答复中的后续提示" : "接下来";
    rail.querySelector("[data-codex-thread-overview-next]").textContent = presentation.nextStep;
    rail.querySelector('[data-kind="next"]').hidden = taskShell;
    rail.querySelector("[data-codex-thread-default-summary]").hidden = taskShell;
    rail.querySelector("[data-codex-thread-master-summary]").textContent = snapshot.summary;
    rail.querySelector("[data-codex-thread-overview-meta]").textContent = taskShell
      ? taskContextForSnapshot(snapshot) ? "摘要由助手维护 · 笔记单独保存" : "摘录自动更新 · 笔记手动保存"
      : `${snapshot.turnCount} 轮对话 · ${snapshot.historyComplete ? "完整记录" : "当前页面"} · 自动更新`;
    rail.querySelector("[data-codex-thread-overview-heading]").textContent = companyMode ? "主控态势" : taskShell ? "任务上下文" : "线程概述";
    const syncButton = rail.querySelector("[data-codex-thread-add-memo]");
    syncButton.hidden = true;
    syncButton.textContent = companyMode ? "同步到未完成工作" : taskShell ? "编辑结论与下一步" : "加入未完成工作";
    syncButton.setAttribute("aria-label", syncButton.textContent);
    const currentCard = rail.querySelector("[data-codex-thread-master-current]");
    const currentContent = rail.querySelector("[data-codex-thread-master-current-content]");
    currentCard.dataset.empty = "false";
    const request = document.createElement("p");
    request.className = "codex-thread-master-work-title";
    request.textContent = compactThreadText(snapshot.currentRequest, 240) || snapshot.title;
    const progress = document.createElement("p");
    progress.className = "codex-thread-master-field";
    const progressLabel = document.createElement("strong");
    progressLabel.textContent = "进度";
    progress.append(progressLabel, document.createTextNode(compactThreadText(snapshot.progress, 240) || "尚未形成进展"));
    const next = document.createElement("p");
    next.className = "codex-thread-master-field";
    const nextLabel = document.createElement("strong");
    nextLabel.textContent = "下一步";
    next.append(nextLabel, document.createTextNode(compactThreadText(snapshot.nextStep, 240) || "等待下一条要求"));
    currentContent.replaceChildren(request, progress, next);
    const timeList = rail.querySelector("[data-codex-thread-master-time-list]");
    timeList.replaceChildren(...timeItems.map((item) => {
      const row = document.createElement("li");
      const content = document.createElement("span");
      const title = document.createElement("span");
      title.className = "codex-thread-master-time-title";
      title.textContent = item.title;
      const detail = document.createElement("span");
      detail.className = "codex-thread-master-time-detail";
      detail.textContent = item.detail;
      content.append(title, detail);
      row.append(content);
      return row;
    }));
    rail.querySelector("[data-codex-thread-master-time-empty]").hidden = timeItems.length > 0;
    const status = rail.querySelector("[data-codex-thread-overview-status]");
    status.textContent = presentation.status;
    status.dataset.running = String(snapshot.running);
  }

  function focusCompanyOperations() {
    ensureThreadOverviewRail();
    openCompanyOperations("home");
    requestAnimationFrame(() => document.getElementById(ASSET_CONSOLE_FRAME_ID)?.focus());
  }

  function openCompanyOperations(workstream = "home") {
    if (!assetConsole.operationsAvailable || !COMPANY_OPERATIONS_WORKSTREAMS.has(workstream)) return;
    const rail = document.getElementById(THREAD_OVERVIEW_RAIL_ID);
    if (!rail || document.documentElement.getAttribute(COMPANY_WORKBENCH_MODE_ATTR) !== "true") return;
    const existing = document.querySelector(`#${ASSET_CONSOLE_PANEL_ID}[data-console-kind="operations"][data-docked="true"]`);
    if (!existing) resetOperationsFrameChannel({ preserveWorkstream: false });
    sendOperationsWorkstream(workstream);
    openAssetConsolePanel("operations", { docked: true });
    const panel = document.getElementById(ASSET_CONSOLE_PANEL_ID);
    if (panel) panel.dataset.workstream = workstream;
    applyCompanyRailLayout(rail);
  }

  function returnToCompanyMaster() {
    closeAssetConsolePanel({ notify: true, focusTarget: "none", destroy: true });
    const rail = document.getElementById(THREAD_OVERVIEW_RAIL_ID);
    if (rail) {
      applyCompanyRailLayout(rail);
      requestAnimationFrame(() => rail.querySelector("[data-codex-company-master-view]")?.focus?.());
    }
  }

  function applyCompanyRailLayout(rail) {
    const companyMode = document.documentElement.getAttribute(COMPANY_WORKBENCH_MODE_ATTR) === "true";
    const master = rail.querySelector("[data-codex-company-master-view]");
    const panel = document.getElementById(ASSET_CONSOLE_PANEL_ID);
    if (!companyMode) {
      if (panel?.dataset.docked === "true" && panel.dataset.consoleKind === "operations") {
        closeAssetConsolePanel({ notify: true, focusTarget: "none", destroy: true });
      }
      return;
    }
    const operationsPanel = panel?.dataset.docked === "true" && panel.dataset.consoleKind === "operations" ? panel : null;
    if (!assetConsole.operationsAvailable && operationsPanel) {
      closeAssetConsolePanel({ notify: true, focusTarget: "none", destroy: true });
    }
    const operationsActive = Boolean(assetConsole.operationsAvailable && operationsPanel?.isConnected);
    rail.dataset.operationsActive = String(operationsActive);
    if (master) master.hidden = operationsActive;
    rail.querySelectorAll("[data-codex-company-workstream]").forEach((button) => {
      button.disabled = !assetConsole.operationsAvailable;
      button.setAttribute("aria-pressed", String(operationsActive && button.dataset.codexCompanyWorkstream === companyOperationsWorkstream));
    });
  }

  function ensureThreadOverviewRail() {
    const snapshot = resolvedCurrentThreadSnapshot() || (() => {
      const threadId = currentConversationThreadId();
      const title = document.querySelector('[data-app-action-sidebar-thread-id][aria-current="page"]')
        ?.getAttribute("data-app-action-sidebar-thread-title") || "当前 Codex 任务";
      return {
        threadId,
        title,
        goal: title,
        currentRequest: title,
        progress: "尚未形成可记录的进展",
        latestAnswer: "",
        summary: "尚未形成可用总结",
        nextStep: "等待你的下一条要求",
        status: "已同步",
        running: false,
        turnCount: 0,
        historyComplete: false,
      };
    })();
    const frame = document.querySelector(
      '[data-app-shell-main-content-layout="thread-edge-scroll"] [data-app-shell-thread-edge-divider="true"]',
    );
    // Newer Codex builds no longer expose the edge-divider marker. Fall back
    // to the main thread viewport so the workspace remains an in-app sibling
    // instead of degrading to a body-level floating panel.
    const host = frame?.querySelector('[data-app-shell-thread-edge-divider="true"]')?.firstElementChild
      || frame?.firstElementChild
      || frame
      || document.querySelector('main[data-app-shell-main-surface]')
      || document.querySelector('main');
    const nativePanelVisible = Array.from(document.querySelectorAll('[data-app-shell-right-panel-full-width="true"]'))
      .some((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return rect.width > 40 && rect.height > 40 && style.display !== "none"
          && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.05;
      });
    if (!host) {
      const docked = document.querySelector(`#${THREAD_OVERVIEW_RAIL_ID} #${ASSET_CONSOLE_PANEL_ID}`);
      if (docked) closeAssetConsolePanel({ notify: true, focusTarget: "none", destroy: true });
      document.getElementById(THREAD_OVERVIEW_RAIL_ID)?.remove();
      return;
    }
    let rail = document.getElementById(THREAD_OVERVIEW_RAIL_ID);
    const expectedLayout = isTaskShell() ? "skill-trace" : "overview";
    if (rail && (rail.dataset.codexPreviewRuntime !== RUNTIME_TOKEN || rail.dataset.overviewLayout !== expectedLayout)) {
      if (rail.querySelector(`#${ASSET_CONSOLE_PANEL_ID}`)) {
        closeAssetConsolePanel({ notify: true, focusTarget: "none", destroy: true });
      }
      rail?.remove();
      rail = null;
    }
    if (!rail) rail = createThreadOverviewRail();
    if (rail.dataset.codexInlineFallback === "true") return;
    if (rail.parentElement !== host || rail !== host.lastElementChild) host.append(rail);
    renderThreadOverviewRail(rail, snapshot);
    applyCompanyRailLayout(rail);
    const companyMode = document.documentElement.getAttribute(COMPANY_WORKBENCH_MODE_ATTR) === "true";
    if (companyMode && assetConsole.operationsAvailable && rail.dataset.companyDefaultViewApplied !== "true") {
      rail.dataset.companyDefaultViewApplied = "true";
      openCompanyOperations("home");
    } else if (!companyMode) {
      delete rail.dataset.companyDefaultViewApplied;
    }
  }

  function handleFolderSearchInput(event) {
    const nextQuery = event.currentTarget.value;
    if (!normalizeFolderSearch(folderSearchQuery) && normalizeFolderSearch(nextQuery)) folderPreSearchId = activeFolderId;
    folderSearchQuery = nextQuery;
    const items = Array.from(folderSources.values());
    const results = rankedFolders(items, folderSearchQuery);
    activeFolderId = results[0]?.id || null;
    updateFolderSwitcherState(items);
  }

  function createFolderSwitcher() {
    const root = document.createElement("div");
    root.id = FOLDER_SWITCHER_ID;
    root.dataset.codexPreviewRuntime = RUNTIME_TOKEN;

    const searchRow = document.createElement("div");
    searchRow.className = "codex-sidebar-folder-search-row";
    const searchShell = document.createElement("div");
    searchShell.className = "codex-sidebar-folder-search-shell";
    const searchIcon = document.createElement("span");
    searchIcon.className = "codex-sidebar-folder-search-icon";
    searchIcon.setAttribute("aria-hidden", "true");
    searchIcon.innerHTML = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.2"/><path d="m10.5 10.5 3 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
    const input = document.createElement("input");
    input.type = "search";
    input.value = folderSearchQuery;
    input.placeholder = "搜索文件夹或项目";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.dataset.codexSidebarFolderSearch = "true";
    input.setAttribute("aria-label", "搜索文件夹或项目");
    input.setAttribute("aria-controls", "codex-sidebar-folder-tags");
    input.oninput = handleFolderSearchInput;
    input.onkeydown = (event) => {
      if (event.key === "Escape" && input.value) {
        event.preventDefault();
        clearFolderSearch();
      } else if (event.key === "ArrowDown") {
        const first = document.querySelector(`#${FOLDER_SWITCHER_ID} [data-codex-sidebar-folder-tag]`);
        if (first) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const clear = document.createElement("button");
    clear.type = "button";
    clear.dataset.codexSidebarFolderClear = "true";
    clear.setAttribute("aria-label", "清除项目搜索");
    clear.title = "清除搜索";
    clear.textContent = "×";
    clear.onclick = clearFolderSearch;
    searchShell.append(searchIcon, input, clear);
    const actions = document.createElement("div");
    actions.dataset.codexSidebarFolderActions = "true";
    actions.setAttribute("aria-label", "当前文件夹操作");
    searchRow.append(searchShell, actions);

    const tags = document.createElement("div");
    tags.id = "codex-sidebar-folder-tags";
    tags.dataset.codexSidebarFolderTags = "true";
    tags.setAttribute("role", "group");
    tags.setAttribute("aria-label", "项目文件夹标签");

    const meta = document.createElement("div");
    meta.className = "codex-sidebar-folder-meta";
    const result = document.createElement("span");
    result.dataset.codexSidebarFolderResult = "true";
    result.setAttribute("role", "status");
    result.setAttribute("aria-live", "polite");
    const expand = document.createElement("button");
    expand.type = "button";
    expand.dataset.codexSidebarFolderExpand = "true";
    expand.setAttribute("aria-controls", tags.id);
    expand.onclick = () => {
      folderTagsExpanded = !folderTagsExpanded;
      updateFolderSwitcherState(Array.from(folderSources.values()));
    };
    expand.innerHTML = '<span>展开全部</span><svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    meta.append(result, expand);
    root.append(searchRow, tags, meta);
    return root;
  }

  function updateFolderSwitcherState(items) {
    const root = document.getElementById(FOLDER_SWITCHER_ID);
    if (!root) return;
    const ranked = rankedFolders(items);
    if (!normalizeFolderSearch(folderSearchQuery) && !items.some((item) => item.id === activeFolderId)) {
      activeFolderId = items.find((item) => item.active)?.id || ranked[0]?.id || null;
    } else if (normalizeFolderSearch(folderSearchQuery) && !ranked.some((item) => item.id === activeFolderId)) {
      activeFolderId = ranked[0]?.id || null;
    }

    for (const item of items) {
      const selected = item.id === activeFolderId;
      item.panelHost.hidden = !selected;
      item.panelHost.dataset.codexSidebarFolderPanel = item.label;
      item.panelHost.dataset.codexSidebarFolderPanelId = item.id;
      item.folder.id = `codex-sidebar-folder-panel-${item.id}`;
      item.folder.setAttribute("aria-labelledby", `codex-sidebar-folder-tag-${item.id}`);
      item.row.dataset.codexSidebarFolderHeadingHidden = "true";
      // Request every native folder behind the single visible panel. Non-empty
      // folders mount their threads, while empty folders safely remain closed.
      // This completes recent-use sorting and project-title search even when
      // Codex originally rendered a populated folder in its collapsed state.
      setNativeFolderExpanded(item);
    }

    const tags = root.querySelector("[data-codex-sidebar-folder-tags]");
    const signature = ranked.map((item) => `${item.id}:${item.lastUsed}`).join("\n");
    if (tags.dataset.signature !== signature) {
      tags.dataset.signature = signature;
      tags.replaceChildren(...ranked.map(createFolderTag));
    }
    tags.dataset.expanded = String(folderTagsExpanded);
    for (const tag of tags.querySelectorAll("[data-codex-sidebar-folder-tag]")) {
      const selected = tag.dataset.codexSidebarFolderTag === activeFolderId;
      tag.setAttribute("aria-pressed", String(selected));
      tag.tabIndex = selected ? 0 : -1;
    }

    const input = root.querySelector("[data-codex-sidebar-folder-search]");
    if (input.value !== folderSearchQuery) input.value = folderSearchQuery;
    const clear = root.querySelector("[data-codex-sidebar-folder-clear]");
    clear.hidden = !folderSearchQuery;
    const result = root.querySelector("[data-codex-sidebar-folder-result]");
    const matchingConversationCount = ranked.reduce(
      (count, item) => count + catalogMatchesForFolder(item).length,
      0,
    );
    result.textContent = !ranked.length
      ? "没有匹配的项目"
      : normalizeFolderSearch(folderSearchQuery)
        ? `找到 ${ranked.length} 个项目 · ${matchingConversationCount} 个对话`
        : `${ranked.length} 个文件夹 · 最近使用优先`;
    const expand = root.querySelector("[data-codex-sidebar-folder-expand]");
    expand.hidden = ranked.length <= 6;
    expand.setAttribute("aria-expanded", String(folderTagsExpanded));
    expand.querySelector("span").textContent = folderTagsExpanded ? "收起" : "展开全部";
    moveActiveFolderActions(items.find((item) => item.id === activeFolderId));
    revealFolderSearchMatch(items.find((item) => item.id === activeFolderId));
  }

  function clearFolderEnhancement() {
    restoreFolderActions();
    document.getElementById(FOLDER_SWITCHER_ID)?.remove();
    document.querySelectorAll("[data-codex-sidebar-folder-heading-hidden]").forEach((row) => {
      row.removeAttribute("data-codex-sidebar-folder-heading-hidden");
    });
    document.querySelectorAll("[data-codex-sidebar-folder-panel]").forEach((panel) => {
      panel.hidden = false;
      panel.removeAttribute("data-codex-sidebar-folder-panel");
      panel.removeAttribute("data-codex-sidebar-folder-panel-id");
    });
    for (const item of folderSources.values()) {
      item.folder.removeAttribute("id");
      item.folder.removeAttribute("aria-labelledby");
    }
    folderSources = new Map();
    folderTogglePending = new Map();
  }

  function ensureFolderSwitcher() {
    const project = sectionSources.get("项目");
    const sources = nativeFolderSources();
    const host = project?.heading?.parentElement;
    if (!project || !sources || !host) return;
    if (requestCompleteNativeFolderList(sources)) return;
    let root = document.getElementById(FOLDER_SWITCHER_ID);
    const signature = sources.items.map((item) => item.id).join("\n");
    const needsRebuild = root?.dataset.codexPreviewRuntime !== RUNTIME_TOKEN
      || root?.parentElement !== host
      || root?.dataset.sourceIds !== signature;
    if (needsRebuild) {
      clearFolderEnhancement();
      root = createFolderSwitcher();
      root.dataset.sourceIds = signature;
      host.insertBefore(root, project.heading.nextElementSibling);
      folderSources = new Map(sources.items.map((item) => [item.id, item]));
      if (!activeFolderId || !folderSources.has(activeFolderId)) {
        activeFolderId = sources.items.find((item) => item.active)?.id || rankedFolders(sources.items, "")[0]?.id || null;
      }
    } else {
      folderSources = new Map(sources.items.map((item) => [item.id, item]));
    }
    updateFolderSwitcherState(sources.items);
  }

  function persistHomeProjectsState() {
    try {
      if (homeProjectsState && typeof homeProjectsState === "object") {
        localStorage.setItem(HOME_PROJECT_STATE_KEY, JSON.stringify(homeProjectsState));
      }
    } catch {}
  }

  function homeProjectRoute(rawThreadId) {
    const threadId = String(rawThreadId || "").trim().replace(/^(?:local|cloud):/i, "");
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(threadId)
      ? `/local/${threadId}`
      : null;
  }

  function updateViewedCompletion(card) {
    if (!card?.projectId || !card?.completionToken) return;
    if (!homeProjectsState || typeof homeProjectsState !== "object") homeProjectsState = {};
    if (!homeProjectsState.seenCompletionByProject || typeof homeProjectsState.seenCompletionByProject !== "object") {
      homeProjectsState.seenCompletionByProject = {};
    }
    homeProjectsState.seenCompletionByProject[card.projectId] = card.completionToken;
    persistHomeProjectsState();
  }

  function openHomeProject(card) {
    const route = homeProjectRoute(card?.threadId);
    if (!route) return;
    updateViewedCompletion(card);
    window.postMessage({ type: "navigate-to-route", path: route }, "*");
  }

  function togglePinnedHomeProject(projectId) {
    if (!projectId) return;
    if (!homeProjectsState || typeof homeProjectsState !== "object") homeProjectsState = {};
    const pinned = new Set(Array.isArray(homeProjectsState.pinnedProjectIds)
      ? homeProjectsState.pinnedProjectIds.filter((id) => typeof id === "string")
      : []);
    const willPin = !pinned.has(projectId);
    if (willPin) pinned.add(projectId);
    else pinned.delete(projectId);
    homeProjectsState.pinnedProjectIds = [...pinned].sort();
    persistHomeProjectsState();

    homeProjects.cards = homeProjects.cards.flatMap((card) => {
      if (card.projectId !== projectId) return [card];
      if (willPin) {
        return [{
          ...card,
          pinned: true,
          phase: card.phase === "active" ? "active" : "pinned",
          statusLabel: card.phase === "active" ? "执行中" : "已钉住",
        }];
      }
      if (card.phase === "active") return [{ ...card, pinned: false }];
      if (card.completionToken) {
        return [{ ...card, pinned: false, phase: "completed", statusLabel: "待查看" }];
      }
      return [];
    });
    document.getElementById(HOME_PROJECT_SHELF_ID)?.removeAttribute("data-signature");
    sync();
  }

  function createHomeProjectCard(card) {
    const root = document.createElement("div");
    root.dataset.codexHomeProjectCard = "true";
    root.dataset.codexHomeProjectId = card.projectId;
    root.dataset.phase = card.phase;

    const open = document.createElement("button");
    open.type = "button";
    open.dataset.codexHomeProjectOpen = "true";
    open.setAttribute("aria-label", `打开“${card.projectName}”项目的关联对话`);
    open.title = card.taskTitle;
    open.onclick = () => openHomeProject(card);

    const avatar = document.createElement("span");
    avatar.className = "codex-home-project-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = Array.from(String(card.projectName || "项目").trim())[0] || "项";

    const name = document.createElement("span");
    name.dataset.codexHomeProjectName = "true";
    name.textContent = card.projectName;

    const task = document.createElement("span");
    task.dataset.codexHomeProjectTask = "true";
    task.textContent = card.taskTitle;

    const meta = document.createElement("span");
    meta.className = "codex-home-project-meta";
    const status = document.createElement("span");
    status.dataset.codexHomeProjectStatus = "true";
    status.textContent = card.statusLabel;
    const count = document.createElement("span");
    count.className = "codex-home-project-active-count";
    count.textContent = card.activeTaskCount > 1
      ? `${card.activeTaskCount} 个任务正在执行`
      : card.phase === "completed"
        ? "完成后待查看"
        : card.phase === "pinned"
          ? "固定显示"
          : card.taskIdentifier || "打开关联对话";
    meta.append(status, count);
    open.append(avatar, name, task, meta);

    const pin = document.createElement("button");
    pin.type = "button";
    pin.dataset.codexHomeProjectPin = "true";
    pin.setAttribute("aria-pressed", String(card.pinned));
    const pinLabel = card.pinned ? `取消钉住“${card.projectName}”项目` : `钉住“${card.projectName}”项目`;
    pin.setAttribute("aria-label", pinLabel);
    pin.title = pinLabel;
    pin.innerHTML = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7.1 3.5h5.8l-.7 4.1 2.3 2.3v1.2H5.5V9.9l2.3-2.3-.7-4.1Z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/><path d="M10 11.1v5.4" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>';
    pin.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      togglePinnedHomeProject(card.projectId);
    };

    root.append(open, pin);
    return root;
  }

  function clearHomeProjectShelf() {
    document.getElementById(HOME_PROJECT_SHELF_ID)?.remove();
    document.querySelectorAll("[data-codex-home-suggestions-hidden]").forEach((node) => {
      node.removeAttribute("data-codex-home-suggestions-hidden");
    });
  }

  function ensureHomeProjectShelf() {
    const composer = document.querySelector('[data-composer-placement="home"]');
    const homeIcon = document.querySelector('[data-testid="home-icon"]');
    const suggestions = document.querySelector('[class*="group/home-suggestions"]');
    const host = suggestions?.parentElement;
    if (!composer || !homeIcon || !suggestions || !host) {
      clearHomeProjectShelf();
      return;
    }

    const cards = Array.isArray(homeProjects.cards) ? homeProjects.cards : [];
    if (homeProjects.available !== false && !cards.length) {
      clearHomeProjectShelf();
      return;
    }

    let shelf = document.getElementById(HOME_PROJECT_SHELF_ID);
    if (shelf?.dataset.codexPreviewRuntime !== RUNTIME_TOKEN || shelf?.parentElement !== host) {
      shelf?.remove();
      shelf = document.createElement("section");
      shelf.id = HOME_PROJECT_SHELF_ID;
      shelf.dataset.codexPreviewRuntime = RUNTIME_TOKEN;
      host.insertBefore(shelf, suggestions);
    } else if (shelf.nextElementSibling !== suggestions) {
      host.insertBefore(shelf, suggestions);
    }

    if (homeProjects.available === false) {
      suggestions.removeAttribute("data-codex-home-suggestions-hidden");
      shelf.dataset.available = "false";
      shelf.setAttribute("role", "status");
      shelf.setAttribute("aria-live", "polite");
      shelf.removeAttribute("aria-label");
      const signature = `unavailable:${homeProjects.message || ""}`;
      if (shelf.dataset.signature !== signature) {
        shelf.dataset.signature = signature;
        shelf.textContent = homeProjects.message || "项目动态暂不可用";
      }
      return;
    }

    suggestions.dataset.codexHomeSuggestionsHidden = "true";
    shelf.dataset.available = "true";
    shelf.setAttribute("role", "region");
    shelf.setAttribute("aria-label", "当前项目");
    shelf.removeAttribute("aria-live");
    const signature = JSON.stringify(cards.map((card) => [
      card.projectId,
      card.taskId,
      card.taskTitle,
      card.phase,
      card.statusLabel,
      card.activeTaskCount,
      card.pinned,
      card.completionToken,
    ]));
    if (shelf.dataset.signature === signature) return;
    shelf.dataset.signature = signature;

    const header = document.createElement("div");
    header.className = "codex-home-project-header";
    const heading = document.createElement("h2");
    heading.className = "codex-home-project-heading";
    heading.textContent = "当前项目";
    const count = document.createElement("span");
    count.className = "codex-home-project-count";
    count.textContent = `${cards.length} 个项目`;
    header.append(heading, count);
    const grid = document.createElement("div");
    grid.dataset.codexHomeProjectGrid = "true";
    grid.append(...cards.map(createHomeProjectCard));
    shelf.replaceChildren(header, grid);
  }

  function updateUsageState() {
    const status = document.getElementById(USAGE_ID);
    if (!status) return;
    const parts = String(usage.text || "剩余量 --").trim().match(/^(.*)\s+(\S+)$/u);
    const label = parts?.[1] || "剩余量";
    const value = parts?.[2] || "--";
    const remaining = Number(usage.remainingPercent);
    const available = usage.available === true && Number.isFinite(remaining);
    const normalizedRemaining = available ? Math.min(100, Math.max(0, Math.round(remaining))) : null;
    status.querySelector(`.${USAGE_TEXT_CLASS}`).textContent = label;
    status.querySelector(`.${USAGE_VALUE_CLASS}`).textContent = value;
    status.querySelector(`.${USAGE_FILL_CLASS}`).style.transform = `scaleX(${(normalizedRemaining ?? 0) / 100})`;
    status.dataset.tone = ["normal", "warning", "critical", "muted"].includes(usage.tone) ? usage.tone : "muted";
    status.dataset.remainingPercent = normalizedRemaining == null ? "" : String(normalizedRemaining);
    status.setAttribute("aria-label", usage.ariaLabel || "Codex 剩余量暂不可用");
    status.title = usage.ariaLabel || "Codex 剩余量暂不可用";
  }

  function ensureUsageStatus(host, switchButton) {
    let status = document.getElementById(USAGE_ID);
    if (status?.dataset.codexPreviewRuntime !== RUNTIME_TOKEN) {
      status?.remove();
      status = null;
    }
    if (!status) {
      status = document.createElement("div");
      status.id = USAGE_ID;
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
      status.dataset.codexPreviewRuntime = RUNTIME_TOKEN;
      const label = document.createElement("span");
      label.className = USAGE_TEXT_CLASS;
      const value = document.createElement("strong");
      value.className = USAGE_VALUE_CLASS;
      const track = document.createElement("span");
      track.className = "codex-conversation-usage-track";
      track.setAttribute("aria-hidden", "true");
      const fill = document.createElement("span");
      fill.className = USAGE_FILL_CLASS;
      track.appendChild(fill);
      status.append(label, value, track);
    }
    if (status.parentElement !== host || status.nextElementSibling !== switchButton) host.insertBefore(status, switchButton);
    updateUsageState();
  }

  function ensureViewToggle() {
    if (!isTaskShell()) {
      document.getElementById(TOGGLE_ID)?.remove();
      return;
    }
    const search = document.querySelector('button[aria-label="搜索"], button[aria-label="Search"]');
    if (!search) return;
    const searchSlot = search.parentElement;
    const host = searchSlot?.parentElement;
    if (!host) return;
    // Usage belongs to the Codex account surface, not this sidebar header.
    document.getElementById(USAGE_ID)?.remove();
    let button = document.getElementById(TOGGLE_ID);
    if (button?.dataset.codexPreviewRuntime !== RUNTIME_TOKEN) {
      button?.remove();
      button = null;
    }
    if (!button) {
      button = document.createElement("button");
      button.id = TOGGLE_ID;
      button.type = "button";
      button.className = `${search.className} codex-conversation-view-switch`;
      button.setAttribute("role", "switch");
      button.dataset.codexPreviewRuntime = RUNTIME_TOKEN;
    }
    button.onclick = handleViewToggle;
    // Codex places search at the far right of this header; the view switch is
    // its immediate sibling so it remains a native-looking utility control.
    if (button.parentElement !== searchSlot) searchSlot.appendChild(button);
    updateViewState();
  }

  function openRow() {
    const rows = visibleRows();
    return rows.find((row) => row.matches(":hover"))
      || rows.find((row) => ["open", "delayed-open"].includes(row.getAttribute("data-state")));
  }

  function appendBlock(container, label, value) {
    const block = document.createElement("div");
    block.className = "codex-conversation-preview-block";
    const labelNode = document.createElement("div");
    labelNode.className = "codex-conversation-preview-label";
    labelNode.textContent = label;
    const textNode = document.createElement("div");
    textNode.className = "codex-conversation-preview-text";
    textNode.textContent = value || "暂无";
    textNode.title = value || "暂无";
    block.append(labelNode, textNode);
    container.appendChild(block);
  }

  function enhanceTooltip() {
    const row = openRow();
    if (!row) return;
    const preview = previews.get(rowKey(row));
    if (!preview) return;
    const title = row.getAttribute("data-app-action-sidebar-thread-title") || "";
    const tooltip = Array.from(document.querySelectorAll('[role="tooltip"]')).find((candidate) =>
      !candidate.querySelector(`.${DETAILS_CLASS}`)
        && Array.from(candidate.querySelectorAll("button")).some((button) => button.textContent.trim() === title),
    );
    if (!tooltip) return;
    const titleButton = Array.from(tooltip.querySelectorAll("button"))
      .find((button) => button.textContent.trim() === title);
    let card = titleButton?.parentElement;
    while (card && card !== tooltip && !card.classList.contains("w-fit")) card = card.parentElement;
    if (!card || card === tooltip) return;

    tooltip.setAttribute("data-codex-conversation-preview-tooltip", "true");
    const details = document.createElement("div");
    details.className = DETAILS_CLASS;
    const taskShell = isTaskShell();
    appendBlock(details, "核心总结", taskShell ? cleanTaskPreviewText(preview.summary, preview.recentOutput) : preview.summary);
    appendBlock(details, "最近输入", taskShell ? cleanTaskPreviewText(preview.recentInput) : preview.recentInput);
    appendBlock(details, "最近输出", taskShell ? cleanTaskPreviewText(preview.recentOutput) : preview.recentOutput);
    card.appendChild(details);
  }

  function escapeSkillLabel(value) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  const skillConfig = window.__CODEX_ENHANCER_CONFIG__?.skills || {};
  const SKILL_CATEGORIES = (Array.isArray(skillConfig.categories) ? skillConfig.categories : []).filter(item =>
    typeof item?.label === "string" && item.label.trim() && !["常用", "全部"].includes(item.label) && Array.isArray(item.keywords));
  const SKILL_FILTERS = ["常用", ...new Set(SKILL_CATEGORIES.map(item => item.label)), "全部"];
  const SKILL_SUBGROUPS = {};

  function normalizedSkillText(value) {
    return String(value || "").trim().toLocaleLowerCase("zh-CN");
  }

  function skillCategoryMatches(entry, category) {
    if (category === "全部") return true;
    if (category === "常用") return skillOrganizerFavorites?.has(entry.title) === true;
    const text = normalizedSkillText(`${entry.title} ${entry.description}`);
    const rule = SKILL_CATEGORIES.find(item => item.label === category);
    return Boolean(rule?.keywords.some(word => typeof word === "string" && word.trim() && text.includes(normalizedSkillText(word))));
  }

  function defaultSkillFavorites(catalog) {
    const titles = new Set(catalog.map(entry => entry.title));
    return new Set((Array.isArray(skillConfig.defaultFavorites) ? skillConfig.defaultFavorites : []).filter(title => titles.has(title)));
  }

  function loadSkillFavorites(catalog) {
    if (skillOrganizerFavorites) return skillOrganizerFavorites;
    try {
      const raw = localStorage.getItem(SKILL_FAVORITES_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          skillOrganizerFavorites = new Set(parsed.filter((title) => typeof title === "string"));
          return skillOrganizerFavorites;
        }
      }
    } catch {}
    skillOrganizerFavorites = defaultSkillFavorites(catalog);
    try { localStorage.setItem(SKILL_FAVORITES_KEY, JSON.stringify([...skillOrganizerFavorites])); } catch {}
    return skillOrganizerFavorites;
  }

  function saveSkillFavorites() {
    try { localStorage.setItem(SKILL_FAVORITES_KEY, JSON.stringify([...(skillOrganizerFavorites || [])])); } catch {}
  }

  function skillEntryFromCard(card) {
    const titleNode = card.querySelector(".font-medium")
      || Array.from(card.querySelectorAll("div")).find((node) => node.classList.contains("truncate"));
    const title = titleNode?.textContent?.trim() || "";
    if (!title) return null;
    const descriptionNode = card.querySelector(".text-token-text-secondary.text-sm")
      || Array.from(card.querySelectorAll("div")).find((node) => node !== titleNode && node.classList.contains("line-clamp-1"));
    return {
      title,
      description: SKILL_DESCRIPTION_OVERRIDES.get(title)
        || descriptionNode?.textContent?.trim()
        || "打开查看 Skill 详情",
      card,
      icon: card.querySelector("svg, img"),
    };
  }

  function collectSkillCatalog(section) {
    return Array.from(section.querySelectorAll('div[role="button"][tabindex="0"]'))
      .filter((card) => card.closest('div[role="button"][tabindex="0"]') === card)
      .map(skillEntryFromCard)
      .filter(Boolean)
      .sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
  }

  function findNativeSkillSearch(section) {
    const scroller = section.closest(".overflow-y-auto") || section.parentElement?.parentElement;
    const input = Array.from(scroller?.querySelectorAll("input") || [])
      .find((candidate) => candidate.placeholder?.trim() === "搜索技能");
    return input?.closest(".sticky") || null;
  }

  function clearSkillOrganizer({ reset = true } = {}) {
    document.getElementById(SKILL_ORGANIZER_ID)?.remove();
    document.querySelectorAll(`[${SKILL_NATIVE_SECTION_ATTR}]`).forEach((node) => node.removeAttribute(SKILL_NATIVE_SECTION_ATTR));
    document.querySelectorAll(`[${SKILL_NATIVE_SEARCH_ATTR}]`).forEach((node) => node.removeAttribute(SKILL_NATIVE_SEARCH_ATTR));
    document.querySelectorAll(`[${SKILL_NATIVE_EXTRA_ATTR}]`).forEach((node) => node.removeAttribute(SKILL_NATIVE_EXTRA_ATTR));
    skillOrganizerRenderSignature = "";
    if (!reset) return;
    skillOrganizerSource = null;
    skillOrganizerCatalog = [];
    skillOrganizerFilter = "常用";
    skillOrganizerQuery = "";
    skillOrganizerNativeVisible = false;
    skillOrganizerExpandRequested = null;
    skillOrganizerExpandedGroups = new Set();
  }

  function makeSkillOrganizerShell(section) {
    const shell = document.createElement("section");
    shell.id = SKILL_ORGANIZER_ID;
    shell.setAttribute("aria-labelledby", `${SKILL_ORGANIZER_ID}-title`);
    shell.innerHTML = `
      <div class="codex-skill-organizer-head">
        <div class="codex-skill-organizer-title-wrap">
          <h2 class="codex-skill-organizer-title" id="${SKILL_ORGANIZER_ID}-title">Skill 工作台</h2>
          <p class="codex-skill-organizer-subtitle">常用置顶，按工作环节归类，点星标即可调整。</p>
        </div>
        <button class="codex-skill-native-toggle" type="button">完整列表</button>
      </div>
      <div class="codex-skill-organizer-tools">
        <label class="codex-skill-search">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m21 21-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          <input type="search" placeholder="搜索名称或用途" autocomplete="off" aria-label="搜索已安装 Skill">
          <button class="codex-skill-search-clear" type="button" aria-label="清除搜索">×</button>
        </label>
        <div class="codex-skill-filter-list" role="group" aria-label="按工作类型筛选 Skill"></div>
      </div>
      <div class="codex-skill-result-head">
        <div class="codex-skill-result-title"></div>
        <div class="codex-skill-result-count" aria-live="polite"></div>
      </div>
      <div class="codex-skill-grid"></div>
    `;

    const input = shell.querySelector("input");
    input.addEventListener("input", () => {
      skillOrganizerQuery = input.value.trim();
      skillOrganizerRenderSignature = "";
      renderSkillOrganizer();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && input.value) {
        event.stopPropagation();
        input.value = "";
        skillOrganizerQuery = "";
        skillOrganizerRenderSignature = "";
        renderSkillOrganizer();
      }
    });
    shell.querySelector(".codex-skill-search-clear").addEventListener("click", () => {
      input.value = "";
      skillOrganizerQuery = "";
      skillOrganizerRenderSignature = "";
      renderSkillOrganizer();
      input.focus();
    });
    shell.querySelector(".codex-skill-filter-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-codex-skill-filter]");
      if (!button) return;
      const selectedFilter = button.getAttribute("data-codex-skill-filter") || "常用";
      skillOrganizerFilter = selectedFilter;
      skillOrganizerRenderSignature = "";
      renderSkillOrganizer();
      [...shell.querySelectorAll("[data-codex-skill-filter]")]
        .find((candidate) => candidate.getAttribute("data-codex-skill-filter") === selectedFilter)
        ?.focus();
    });
    shell.querySelector(".codex-skill-native-toggle").addEventListener("click", () => {
      skillOrganizerNativeVisible = !skillOrganizerNativeVisible;
      skillOrganizerRenderSignature = "";
      renderSkillOrganizer();
      if (skillOrganizerNativeVisible) section.scrollIntoView({ block: "nearest" });
    });
    section.parentElement?.insertBefore(shell, section);
    return shell;
  }

  function openSkillEntry(entry) {
    if (!entry?.card?.isConnected) return;
    entry.card.click();
    setTimeout(scheduleSync, 120);
  }

  function syncNativeSkillVisibility() {
    const section = skillOrganizerSource;
    if (!section?.isConnected) return;
    const visibility = skillOrganizerNativeVisible ? "visible" : "hidden";
    section.setAttribute(SKILL_NATIVE_SECTION_ATTR, visibility);
    for (let sibling = section.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
      sibling.setAttribute(SKILL_NATIVE_EXTRA_ATTR, visibility);
    }
    const nativeSearch = findNativeSkillSearch(section);
    if (nativeSearch) nativeSearch.setAttribute(SKILL_NATIVE_SEARCH_ATTR, "hidden");
  }

  function groupedSkillEntries(entries, category) {
    const definitions = SKILL_SUBGROUPS[category];
    if (!definitions?.length) return [];
    const groups = definitions.map((definition) => ({ ...definition, entries: [] }));
    const fallback = groups.find((group) => !group.pattern) || groups[groups.length - 1];
    for (const entry of entries) {
      const text = `${entry.title} ${entry.description}`;
      const group = groups.find((candidate) => candidate.pattern?.test(entry.title))
        || groups.find((candidate) => candidate.pattern?.test(text))
        || fallback;
      group.entries.push(entry);
    }
    return groups.filter((group) => group.entries.length > 0);
  }

  function createSkillOrganizerRow(entry) {
    const row = document.createElement("div");
    row.className = "codex-skill-row";
    row.setAttribute("role", "button");
    row.tabIndex = 0;
    row.setAttribute("aria-label", `打开 ${entry.title}`);

    const icon = document.createElement("span");
    icon.className = "codex-skill-icon";
    if (entry.icon) icon.appendChild(entry.icon.cloneNode(true));
    else icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 14.2 8.8 20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2L12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

    const copy = document.createElement("span");
    copy.className = "codex-skill-copy";
    const name = document.createElement("span");
    name.className = "codex-skill-name";
    name.textContent = entry.title;
    const description = document.createElement("span");
    description.className = "codex-skill-description";
    description.textContent = entry.description;
    copy.append(name, description);

    const favorite = document.createElement("button");
    favorite.type = "button";
    favorite.className = "codex-skill-favorite";
    const isFavorite = skillOrganizerFavorites.has(entry.title);
    favorite.setAttribute("aria-pressed", isFavorite ? "true" : "false");
    favorite.setAttribute("aria-label", `${isFavorite ? "取消常用" : "加入常用"}：${entry.title}`);
    favorite.title = isFavorite ? "从常用移除" : "加入常用";
    favorite.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 2.72 5.51 6.08.88-4.4 4.29 1.04 6.05L12 16.87l-5.44 2.86 1.04-6.05-4.4-4.29 6.08-.88L12 3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" fill="currentColor" fill-opacity=".16"/></svg>';
    favorite.addEventListener("click", (event) => {
      event.stopPropagation();
      if (skillOrganizerFavorites.has(entry.title)) skillOrganizerFavorites.delete(entry.title);
      else skillOrganizerFavorites.add(entry.title);
      saveSkillFavorites();
      skillOrganizerRenderSignature = "";
      renderSkillOrganizer();
    });
    row.addEventListener("click", () => openSkillEntry(entry));
    row.addEventListener("keydown", (event) => {
      if (event.target !== row) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openSkillEntry(entry);
    });
    row.append(icon, copy, favorite);
    return row;
  }

  function createSkillOrganizerGroup(group, category) {
    const groupKey = `${category}:${group.id}`;
    const wrapper = document.createElement("section");
    wrapper.className = "codex-skill-group";
    wrapper.setAttribute("data-codex-skill-group", group.id);
    wrapper.setAttribute("data-codex-skill-group-label", group.label);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "codex-skill-group-toggle";
    const bodyId = `${SKILL_ORGANIZER_ID}-group-${group.id}`;
    const expanded = skillOrganizerExpandedGroups.has(groupKey);
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    toggle.setAttribute("aria-controls", bodyId);
    toggle.setAttribute("aria-label", `${group.label}，${group.entries.length} 个 Skill`);
    toggle.innerHTML = `
      <span class="codex-skill-group-copy">
        <span class="codex-skill-group-title"></span>
        <span class="codex-skill-group-description"></span>
      </span>
      <span class="codex-skill-group-count" aria-hidden="true">${group.entries.length}</span>
      <span class="codex-skill-group-chevron" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="m7.5 5 5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    `;
    toggle.querySelector(".codex-skill-group-title").textContent = group.label;
    toggle.querySelector(".codex-skill-group-description").textContent = group.description;

    const body = document.createElement("div");
    body.id = bodyId;
    body.className = "codex-skill-group-items";
    body.hidden = !expanded;
    for (const entry of group.entries) body.appendChild(createSkillOrganizerRow(entry));

    toggle.addEventListener("click", () => {
      const shouldExpand = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", shouldExpand ? "true" : "false");
      body.hidden = !shouldExpand;
      if (shouldExpand) skillOrganizerExpandedGroups.add(groupKey);
      else skillOrganizerExpandedGroups.delete(groupKey);
    });
    wrapper.append(toggle, body);
    return wrapper;
  }

  function renderSkillOrganizer() {
    const shell = document.getElementById(SKILL_ORGANIZER_ID);
    const section = skillOrganizerSource;
    if (!shell || !section?.isConnected) return;
    syncNativeSkillVisibility();
    loadSkillFavorites(skillOrganizerCatalog);
    const query = normalizedSkillText(skillOrganizerQuery);
    const favoriteSignature = [...(skillOrganizerFavorites || [])].sort((a, b) => a.localeCompare(b, "zh-CN")).join("\u0001");
    const signature = [skillOrganizerFilter, query, skillOrganizerNativeVisible, favoriteSignature, skillOrganizerCatalog.map((entry) => entry.title).join("\u0002")].join("\u0003");
    if (signature === skillOrganizerRenderSignature) return;
    skillOrganizerRenderSignature = signature;

    shell.setAttribute("data-has-query", query ? "true" : "false");
    shell.querySelector(".codex-skill-native-toggle").textContent = skillOrganizerNativeVisible ? "返回整理视图" : "完整列表";

    const filters = shell.querySelector(".codex-skill-filter-list");
    filters.replaceChildren();
    for (const label of SKILL_FILTERS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "codex-skill-filter";
      button.setAttribute("data-codex-skill-filter", label);
      button.setAttribute("aria-pressed", label === skillOrganizerFilter ? "true" : "false");
      button.textContent = label;
      filters.appendChild(button);
    }

    const visible = skillOrganizerCatalog.filter((entry) => {
      if (query) return normalizedSkillText(`${entry.title} ${entry.description}`).includes(query);
      return skillCategoryMatches(entry, skillOrganizerFilter);
    });
    const groups = query || skillOrganizerFilter === "常用" || skillOrganizerFilter === "全部"
      ? []
      : groupedSkillEntries(visible, skillOrganizerFilter);
    shell.querySelector(".codex-skill-result-title").textContent = query ? "搜索结果" : skillOrganizerFilter;
    shell.querySelector(".codex-skill-result-count").textContent = groups.length
      ? `显示 ${visible.length} · ${groups.length} 组 · 已安装 ${skillOrganizerCatalog.length}`
      : `显示 ${visible.length} · 已安装 ${skillOrganizerCatalog.length}`;

    const grid = shell.querySelector(".codex-skill-grid");
    const fragment = document.createDocumentFragment();
    if (groups.length) {
      for (const group of groups) fragment.appendChild(createSkillOrganizerGroup(group, skillOrganizerFilter));
    } else {
      for (const entry of visible) fragment.appendChild(createSkillOrganizerRow(entry));
    }
    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "codex-skill-empty";
      empty.textContent = query ? "没找到匹配的 Skill，换个关键词试试。" : "这个分类还没有 Skill。";
      const allButton = document.createElement("button");
      allButton.type = "button";
      allButton.textContent = "查看全部";
      allButton.addEventListener("click", () => {
        skillOrganizerQuery = "";
        skillOrganizerFilter = "全部";
        const input = shell.querySelector("input");
        if (input) input.value = "";
        skillOrganizerRenderSignature = "";
        renderSkillOrganizer();
      });
      empty.appendChild(allButton);
      fragment.appendChild(empty);
    }
    grid.replaceChildren(fragment);
  }

  function ensureSkillOrganizer() {
    const section = document.querySelector("section#skills-installed");
    if (!section) {
      if (skillOrganizerSource || document.getElementById(SKILL_ORGANIZER_ID)) clearSkillOrganizer();
      return;
    }
    if (skillOrganizerSource && skillOrganizerSource !== section) clearSkillOrganizer();
    skillOrganizerSource = section;

    const nativeCards = Array.from(section.querySelectorAll('div[role="button"][tabindex="0"]'));
    const expandButton = Array.from(section.querySelectorAll('button[aria-expanded="false"]'))
      .find((button) => /另有|查看|展开/.test(button.textContent || ""));
    if (expandButton) {
      if (skillOrganizerExpandRequested !== expandButton) {
        skillOrganizerExpandRequested = expandButton;
        expandButton.click();
      }
      return;
    }

    const catalog = collectSkillCatalog(section);
    if (!catalog.length) return;
    const catalogSignature = catalog.map((entry) => `${entry.title}\u0000${entry.description}`).join("\u0001");
    const previousSignature = skillOrganizerCatalog.map((entry) => `${entry.title}\u0000${entry.description}`).join("\u0001");
    if (catalogSignature !== previousSignature) {
      skillOrganizerCatalog = catalog;
      skillOrganizerRenderSignature = "";
    } else {
      for (let index = 0; index < catalog.length; index += 1) {
        skillOrganizerCatalog[index].card = catalog[index].card;
        skillOrganizerCatalog[index].icon = catalog[index].icon;
      }
    }
    let shell = document.getElementById(SKILL_ORGANIZER_ID);
    if (!shell || shell.parentElement !== section.parentElement || shell.nextElementSibling !== section) {
      shell?.remove();
      shell = makeSkillOrganizerShell(section);
      skillOrganizerRenderSignature = "";
    }
    syncNativeSkillVisibility();
    renderSkillOrganizer();
  }

  function sync() {
    ensureTaskAssetComposerChips();
    ensureTaskSkillComposerChips();
    ensurePromptDepthControl();
    if (destroyed) return;
    restoreTaskViewPreference();
    syncCustomWorkspaceMode();
    syncAssetConsoleTaskContext();
    clearShortcutEnhancement();
    ensureLocalConsoleEntries();
    enforceExclusiveNavigationSelection();
    // Projects stay entirely native. The enhancer must not mirror or intercept
    // the project manager; list/card view applies only to task rows below it.
    clearProjectSidebarManager();
    ensureProjectAppearanceCustomization();
    // Skill 工作台已迁移到独立的“技能可视化”页面。原生插件页只保留
    // Codex 自带的技能列表，避免两套管理界面同时注入、互相覆盖。
    clearSkillOrganizer();
    ensureViewToggle();
    // The native Codex sidebar owns the Projects/Tasks sections. Remove any
    // stale enhancer tab bar left by an older injected runtime.
    document.getElementById(SECTION_TABS_ID)?.remove();
    if (ENABLE_PROJECT_PAGE_ENHANCEMENTS) {
      ensureSectionTabs();
      ensureFolderSwitcher();
    } else {
      clearSectionEnhancement();
      clearHomeProjectShelf();
    }
    updateViewState();
    if (document.querySelector(".asset-shell, [data-task-asset-console-host], #codex-asset-console-panel, iframe[src*='asset-console']")) {
      closeSkillActivityPopover();
      document.getElementById(SKILL_ACTIVITY_TRIGGER_ID)?.remove();
      document.getElementById(THREAD_OVERVIEW_RAIL_ID)?.remove();
      return;
    }
    if (isTaskShell()) {
      const staleRail = document.getElementById(THREAD_OVERVIEW_RAIL_ID);
      if (staleRail?.querySelector(`#${ASSET_CONSOLE_PANEL_ID}`)) {
        closeAssetConsolePanel({ notify: false, focusTarget: "none", destroy: true });
      }
      staleRail?.remove();
      ensureSkillActivityTrigger();
    } else {
      closeSkillActivityPopover();
      document.getElementById(SKILL_ACTIVITY_TRIGGER_ID)?.remove();
      // Native workspace pages (Plugins, Skills, Asset Library, Projects)
      // must not receive the task-only overview rail. Keep it only for the
      // dedicated company workbench, where the rail is part of that layout.
      if (document.documentElement.getAttribute(COMPANY_WORKBENCH_MODE_ATTR) === "true") {
        ensureThreadOverviewRail();
      } else {
        closeAssetConsolePanel({ notify: false, focusTarget: "none", destroy: true });
        document.getElementById(THREAD_OVERVIEW_RAIL_ID)?.remove();
        clearSidebarTaskEnhancements();
      }
    }
    clearNonSidebarTaskEnhancements();
    if (isTaskShell()) {
      const rows = visibleRows();
      const anchor = !layoutAnchored
        ? rows.find((row) => row.getAttribute("aria-current") === "page")
          || rows.find((row) => row.getAttribute("data-app-action-sidebar-thread-active") === "true")
          || rows.find((row) => {
            const rect = row.getBoundingClientRect();
            return rect.bottom > 0 && rect.top < innerHeight;
          })
        : null;
      for (const row of rows) applySummary(row, previews.get(rowKey(row)));
      if (anchor) {
        anchor.scrollIntoView({ block: currentViewMode() === "card" ? "center" : "nearest" });
        layoutAnchored = true;
      }
    } else {
      clearSidebarTaskEnhancements();
    }
    enhanceTooltip();
  }

  function setPreviews(items) {
    previews = new Map((Array.isArray(items) ? items : []).map((preview) => [preview.key, preview]));
    sync();
  }

  function setThreadOverview(value) {
    threadOverview = value && typeof value === "object" ? value : null;
    const threadId = normalizedThreadId(threadOverview?.threadId);
    const savedMode = threadOverview?.taskContext?.prompt_depth_mode
      || threadOverview?.taskContext?.processing_depth;
    const savedComplexity = threadOverview?.taskContext?.prompt_description_complexity;
    if (threadId && PROMPT_DEPTH_VALUES.includes(savedMode)) {
      promptDepthByThread.set(threadId, {
        workflow: savedMode,
        complexity: PROMPT_COMPLEXITY_VALUES.includes(savedComplexity) ? savedComplexity : "high",
      });
      persistPromptDepths();
    }
    sync();
  }

  function skillActivityState(trace = skillTrace) {
    const skills = Array.isArray(trace?.skills) ? trace.skills : [];
    const failed = skills.filter((item) => item.status === "failed").length;
    const running = skills.filter((item) => item.status === "running").length;
    const status = trace?.syncStatus === "disconnected" || trace?.status === "unavailable"
      ? "disconnected"
      : trace?.syncStatus === "degraded"
        ? "degraded"
        : failed || trace?.status === "failed"
      ? "failed"
      : running || trace?.status === "running"
        ? "running"
        : skills.length
          ? "completed"
          : "idle";
    return { skills, failed, running, status, trace };
  }

  function skillActivitySummary(state) {
    if (state.status === "disconnected") return "数据源断开 · 等待重连";
    if (state.status === "degraded") return "同步异常 · 正在重试";
    if (state.status === "failed") return state.failed ? `${state.failed} 项失败 · 共 ${state.skills.length} 项` : `执行失败 · 共 ${state.skills.length} 项`;
    if (state.status === "running") return state.running ? `${state.running} 项执行中 · 共 ${state.skills.length} 项` : `任务执行中 · ${state.skills.length} 项技能`;
    if (state.skills.length) return `${state.skills.length} 项技能`;
    return "本轮暂无调用";
  }

  function renderSkillActivityUi() {
    const state = skillActivityState();
    const trigger = document.getElementById(SKILL_ACTIVITY_TRIGGER_ID);
    if (trigger) {
      trigger.dataset.status = state.status;
      trigger.querySelector("[data-codex-skill-activity-count]").textContent = String(state.skills.length);
      const label = state.status === "disconnected"
        ? "技能活动，数据源断开，等待重连"
        : state.status === "degraded"
          ? "技能活动，同步异常，正在重试"
          : state.failed
        ? `技能活动，${state.skills.length} 项，${state.failed} 项失败`
        : state.running
          ? `技能活动，${state.skills.length} 项，${state.running} 项执行中`
          : `技能活动，${state.skills.length} 项`;
      trigger.setAttribute("aria-label", label);
      trigger.title = label;
    }
    const popover = document.getElementById(SKILL_ACTIVITY_POPOVER_ID);
    if (popover) {
      popover.dataset.status = state.status;
      popover.querySelector("[data-codex-skill-activity-summary]").textContent = skillActivitySummary(state);
      const section = popover.querySelector("[data-codex-task-skill-trace]");
      if (section) renderTaskSkillTraceSection(section, skillTrace);
      const errorNode = popover.querySelector("[data-codex-skill-activity-error]");
      if (errorNode) {
        errorNode.hidden = !state.trace?.syncError;
        errorNode.textContent = state.trace?.syncError || "";
      }
      positionSkillActivityPopover();
    }
  }

  function ensureSkillActivityTrigger() {
    const threadId = normalizedThreadId(currentConversationThreadId());
    if (threadId !== skillActivityThreadId) {
      closeSkillActivityPopover();
      skillActivityThreadId = threadId;
    }
    const toolbar = document.querySelector('[data-app-shell-header-toolbar="true"]');
    const titleArea = toolbar?.firstElementChild;
    if (!toolbar || !titleArea) {
      closeSkillActivityPopover();
      document.getElementById(SKILL_ACTIVITY_TRIGGER_ID)?.remove();
      return;
    }
    let trigger = document.getElementById(SKILL_ACTIVITY_TRIGGER_ID);
    if (trigger && trigger.dataset.codexPreviewRuntime !== RUNTIME_TOKEN) {
      trigger.remove();
      trigger = null;
    }
    if (!trigger) {
      trigger = document.createElement("button");
      trigger.id = SKILL_ACTIVITY_TRIGGER_ID;
      trigger.type = "button";
      trigger.className = "no-drag";
      trigger.dataset.codexPreviewRuntime = RUNTIME_TOKEN;
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-controls", SKILL_ACTIVITY_POPOVER_ID);
      trigger.setAttribute("aria-expanded", "false");
      trigger.innerHTML = '<span class="codex-skill-activity-dot" aria-hidden="true"></span><span data-codex-skill-activity-count>0</span>';
      trigger.onclick = (event) => {
        event.stopPropagation();
        if (document.getElementById(SKILL_ACTIVITY_POPOVER_ID)) closeSkillActivityPopover();
        else openSkillActivityPopover();
      };
    }
    if (trigger.parentElement !== document.body) document.body.append(trigger);
    positionSkillActivityTrigger();
    renderSkillActivityUi();
  }

  function positionSkillActivityTrigger() {
    const trigger = document.getElementById(SKILL_ACTIVITY_TRIGGER_ID);
    const toolbar = document.querySelector('[data-app-shell-header-toolbar="true"]');
    const titleArea = toolbar?.firstElementChild;
    if (!trigger || !toolbar || !titleArea) return;
    const toolbarRect = toolbar.getBoundingClientRect();
    const titleRect = titleArea.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const left = Math.min(titleRect.right + 4, toolbarRect.right - triggerRect.width);
    trigger.style.left = `${Math.round(Math.max(toolbarRect.left, left))}px`;
    trigger.style.top = `${Math.round(toolbarRect.top + (toolbarRect.height - triggerRect.height) / 2)}px`;
  }

  function openSkillActivityPopover() {
    const trigger = document.getElementById(SKILL_ACTIVITY_TRIGGER_ID);
    if (!trigger) return;
    closeSkillActivityPopover();
    const popover = document.createElement("aside");
    popover.id = SKILL_ACTIVITY_POPOVER_ID;
    popover.dataset.codexPreviewRuntime = RUNTIME_TOKEN;
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", "技能活动");
    popover.innerHTML = `
      <div class="codex-skill-activity-header">
        <h2>技能活动</h2>
        <span data-codex-skill-activity-summary></span>
        <button type="button" data-codex-skill-activity-close aria-label="关闭技能活动" title="关闭">×</button>
      </div>
      <p data-codex-skill-activity-error hidden></p>
    `;
    const section = createTaskSkillTraceSection();
    popover.append(section);
    popover.querySelector("[data-codex-skill-activity-close]").onclick = () => closeSkillActivityPopover({ restoreFocus: true });
    document.body.append(popover);
    trigger.setAttribute("aria-expanded", "true");
    renderSkillActivityUi();
    requestAnimationFrame(positionSkillActivityPopover);
  }

  function closeSkillActivityPopover({ restoreFocus = false } = {}) {
    const trigger = document.getElementById(SKILL_ACTIVITY_TRIGGER_ID);
    document.getElementById(SKILL_ACTIVITY_POPOVER_ID)?.remove();
    trigger?.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger?.focus();
  }

  function positionSkillActivityPopover() {
    const trigger = document.getElementById(SKILL_ACTIVITY_TRIGGER_ID);
    const popover = document.getElementById(SKILL_ACTIVITY_POPOVER_ID);
    if (!trigger || !popover) return;
    const triggerRect = trigger.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const toolbarRect = document.querySelector('[data-app-shell-header-toolbar="true"]')?.getBoundingClientRect();
    const contentLeft = Math.max(8, toolbarRect?.left || 8);
    const maxLeft = innerWidth - popoverRect.width - 8;
    const left = maxLeft >= contentLeft
      ? Math.min(Math.max(contentLeft, triggerRect.right - popoverRect.width), maxLeft)
      : Math.max(8, maxLeft);
    const below = triggerRect.bottom + 6;
    const top = below + popoverRect.height <= innerHeight - 8
      ? below
      : Math.max(8, triggerRect.top - popoverRect.height - 6);
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
  }

  function createTaskPromptStatusSection() {
    const section = document.createElement("section");
    section.setAttribute("data-codex-task-prompt-status", "");
    section.innerHTML = `
      <div class="codex-prompt-status-head">
        <h3>生成前检查</h3>
        <span data-prompt-status-state>等待任务</span>
      </div>
      <div class="codex-prompt-status-grid">
        <div class="codex-prompt-status-cell"><span>工作流</span><strong data-prompt-status-workflow>不适用</strong></div>
        <div class="codex-prompt-status-cell"><span>复杂度</span><strong data-prompt-status-complexity>高</strong></div>
        <div class="codex-prompt-status-cell"><span>编译</span><strong data-prompt-status-compilation>未编译</strong></div>
      </div>
      <p data-prompt-status-hint>仅对拆分镜任务生效；生成前会重新读取当前任务设置。</p>
    `;
    return section;
  }

  function renderTaskPromptStatusSection(section, snapshot) {
    if (!section) return;
    const threadId = normalizedThreadId(snapshot?.threadId || promptDepthThreadId());
    const value = promptDepthForThread(threadId);
    const hasTask = Boolean(threadId);
    const context = taskContextForSnapshot(snapshot);
    const workflow = promptDepthButtonLabel(value.workflow);
    const complexity = value.complexity === "low" ? "低" : value.complexity === "medium" ? "中" : "高";
    const receipt = context?.prompt_compilation_receipt;
    const receiptWorkflow = receipt?.workflow_mode || (receipt?.processing_depth || "");
    const workflowMatches = value.workflow === "none" ? receiptWorkflow === "none" : receiptWorkflow === value.workflow;
    const complexityMatches = receipt?.prompt_description_complexity === value.complexity;
    const compilation = !hasTask
      ? "等待任务"
      : !receipt
        ? "未编译"
        : workflowMatches && complexityMatches ? "已按当前路由编译" : "设置已变更";
    section.dataset.state = hasTask ? "configured" : "idle";
    section.querySelector("[data-prompt-status-state]").textContent = hasTask
      ? context?.prompt_depth_mode || context?.processing_depth ? "已写入任务" : "当前设置"
      : "等待任务";
    section.querySelector("[data-prompt-status-workflow]").textContent = workflow;
    section.querySelector("[data-prompt-status-complexity]").textContent = complexity;
    section.querySelector("[data-prompt-status-compilation]").textContent = compilation;
  }

  function handleSkillActivityPointerDown(event) {
    const popover = document.getElementById(SKILL_ACTIVITY_POPOVER_ID);
    if (!popover) return;
    if (popover.contains(event.target) || document.getElementById(SKILL_ACTIVITY_TRIGGER_ID)?.contains(event.target)) return;
    closeSkillActivityPopover();
  }

  function handleSkillActivityKeydown(event) {
    if (event.key !== "Escape" || !document.getElementById(SKILL_ACTIVITY_POPOVER_ID)) return;
    event.preventDefault();
    event.stopPropagation();
    closeSkillActivityPopover({ restoreFocus: true });
  }

  function setSkillTrace(value) {
    const next = value && typeof value === "object" ? value : null;
    const nextThreadId = normalizedThreadId(next?.threadId);
    if (skillActivityThreadId && nextThreadId && nextThreadId !== skillActivityThreadId) closeSkillActivityPopover();
    if (nextThreadId) skillTraceByThread.set(nextThreadId, next);
    const activeThreadId = normalizedThreadId(currentConversationThreadId());
    skillTrace = skillTraceByThread.get(activeThreadId) || (nextThreadId === activeThreadId ? next : null);
    skillActivityThreadId = nextThreadId;
    document.querySelectorAll("[data-codex-task-skill-trace]").forEach((section) => renderTaskSkillTraceSection(section, skillTrace));
    renderSkillActivityUi();
  }

  function createTaskSkillTraceSection() {
    const section = document.createElement("section");
    section.setAttribute("data-codex-task-skill-trace", "");
    section.innerHTML = '<div class="codex-task-skills-heading"><h3>本任务调用</h3><span data-skill-trace-summary>实时同步</span></div><div data-skill-trace-list></div>';
    return section;
  }

  function renderTaskSkillTraceSection(section, trace) {
    const list = section.querySelector("[data-skill-trace-list]");
    const skills = Array.isArray(trace?.skills) ? trace.skills : [];
    const summary = section.querySelector("[data-skill-trace-summary]");
    const running = skills.filter((item) => item.status === "running").length;
    const failed = skills.filter((item) => item.status === "failed").length;
    summary.textContent = skills.length ? `${skills.length} 项 · ${running ? `${running} 项读取中` : failed ? `${failed} 项失败` : "实时"}` : "实时";
    list.replaceChildren();
    if (!skills.length) {
      const empty = document.createElement("p");
      empty.className = "codex-task-skill-trace-empty";
      empty.textContent = "本轮任务尚未检测到技能调用";
      list.append(empty);
      return;
    }
    const formatDuration = (value) => {
      const milliseconds = Number(value);
      if (!Number.isFinite(milliseconds) || milliseconds < 0) return "";
      return milliseconds < 1000 ? `耗时 ${Math.round(milliseconds)} 毫秒` : `耗时 ${(milliseconds / 1000).toFixed(milliseconds < 10_000 ? 1 : 0)} 秒`;
    };
    const formatTime = (value) => {
      const time = new Date(value || "");
      if (Number.isNaN(time.getTime())) return "";
      return time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    };
    for (const item of skills) {
      const row = document.createElement("article"); row.className = "codex-skill-trace-node"; row.dataset.status = item.status || "unknown";
      const rawSkill = item.skill || item.label || "未命名技能";
      const title = document.createElement("strong");
      title.textContent = SKILL_NAME_ZH[rawSkill] ? `${SKILL_NAME_ZH[rawSkill]}（${rawSkill}）` : rawSkill;
      const status = document.createElement("span");
      status.className = "codex-skill-trace-status";
      status.textContent = item.status === "failed" ? "读取失败" : item.status === "running" ? "读取中" : item.status === "completed" ? "已加载" : "等待结果";
      const head = document.createElement("div");
      head.className = "codex-skill-trace-node-head";
      head.append(title, status);
      const meta = document.createElement("div");
      meta.className = "codex-skill-trace-meta";
      const time = formatTime(item.timestamp);
      const duration = formatDuration(item.durationMs);
      if (duration) { const node = document.createElement("span"); node.textContent = duration.replace(/^耗时\s*/, ""); meta.append(node); }
      if (Number(item.attempts) > 1) { const node = document.createElement("span"); node.textContent = `${item.attempts} 次读取`; meta.append(node); }
      if (time) { const node = document.createElement("span"); node.textContent = time; meta.append(node); }
      const detailText = item.status === "failed" ? item.reason || item.message || "" : "";
      const detail = document.createElement("p");
      detail.className = "codex-skill-trace-detail";
      detail.dataset.failure = String(item.status === "failed");
      detail.textContent = detailText;
      row.append(head);
      if (meta.childElementCount) row.append(meta);
      if (detailText) row.append(detail);
      list.append(row);
    }
  }

  function setSearchCatalog(items) {
    searchCatalog = (Array.isArray(items) ? items : []).filter((entry) =>
      entry && typeof entry.projectId === "string" && typeof entry.title === "string",
    );
    searchCatalogByProject = new Map();
    for (const entry of searchCatalog) {
      const entries = searchCatalogByProject.get(entry.projectId) || [];
      entries.push(entry);
      searchCatalogByProject.set(entry.projectId, entries);
    }
    sync();
  }

  function setUsage(value) {
    usage = value && typeof value === "object" ? value : {
      available: false,
      text: "剩余量 --",
      remainingPercent: null,
      tone: "muted",
      ariaLabel: "Codex 剩余量暂不可用",
    };
    sync();
  }

  function setHomeProjects(value) {
    const source = value && typeof value === "object" ? value : {};
    homeProjects = {
      available: source.available !== false,
      projects: Array.isArray(source.projects) ? source.projects : [],
      cards: Array.isArray(source.cards) ? source.cards : [],
      message: typeof source.message === "string" ? source.message : "",
    };
    if (source.state && typeof source.state === "object") {
      homeProjectsState = source.state;
      persistHomeProjectsState();
    }
    sync();
  }

  function setAssetConsole(value) {
    const source = value && typeof value === "object" ? value : {};
    assetConsole = {
      available: source.available === true,
      assetAvailable: source.assetAvailable === true,
      operationsAvailable: source.operationsAvailable === true,
      label: typeof source.label === "string" && source.label.trim() ? source.label.trim() : "资产库",
      mode: source.mode === "embedded" ? "embedded" : "external",
    };
    if (!assetConsole.available) closeAssetConsolePanel({ notify: false, destroy: true });
    sync();
  }

  function setSkillConsole(value) {
    const source = value && typeof value === "object" ? value : {};
    skillConsole = {
      available: source.available !== false,
      label: typeof source.label === "string" && source.label.trim() ? source.label.trim() : "技能",
      mode: source.mode === "embedded" ? "embedded" : "external",
    };
    sync();
  }

  function getHomeProjectsState() {
    return homeProjectsState;
  }

  function scheduleSync() {
    if (destroyed || syncTimer) return;
    syncTimer = setTimeout(() => {
      syncTimer = null;
      sync();
    }, 80);
  }

  function projectMutationTarget(record) {
    const target = record?.target instanceof Element
      ? record.target
      : record?.target?.parentElement;
    return target?.closest("[data-sidebar-project-kind]") || null;
  }

  function isProjectOnlyMutation(record) {
    const project = projectMutationTarget(record);
    if (!project) return false;
    if (record.type === "attributes" && record.attributeName === "aria-expanded") {
      return Boolean(record.target?.matches?.("[data-app-action-sidebar-project-row]"));
    }
    // React may insert/remove the project task list while opening a group. The
    // native tree already owns that layout; avoid a full sidebar rebuild.
    return record.type === "childList";
  }

  function enhanceAddedTaskRows(records) {
    if (!isTaskShell()) return;
    const seen = new Set();
    for (const record of records) {
      for (const node of record.addedNodes || []) {
        if (!(node instanceof Element)) continue;
        const rows = node.matches?.(ROW_SELECTOR)
          ? [node]
          : Array.from(node.querySelectorAll?.(ROW_SELECTOR) || []);
        for (const row of rows) {
          if (seen.has(row) || !row.isConnected) continue;
          seen.add(row);
          applySummary(row, previews.get(rowKey(row)));
        }
      }
    }
  }

  function handleMutations(records) {
    if (destroyed || !records?.length) return;
    const projectOnly = records.every(isProjectOnlyMutation);
    if (projectOnly) {
      enhanceAddedTaskRows(records);
      return;
    }
    scheduleSync();
  }

  function start() {
    installStyles();
    updateViewState();
    observer = new MutationObserver(handleMutations);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-state",
        "aria-expanded",
        "aria-current",
        "data-active",
        "data-selected",
        "data-app-action-sidebar-thread-active",
        "data-app-action-sidebar-thread-selected",
        "class",
        "data-theme",
      ],
    });
    document.addEventListener("pointerover", scheduleSync, true);
    document.addEventListener("click", handleCustomWorkspaceNavigation, true);
    document.addEventListener("click", handleTopLevelNavigationSelection, true);
    document.addEventListener("pointerdown", handleSkillActivityPointerDown, true);
    document.addEventListener("keydown", handleAssetConsoleKeydown, true);
    document.addEventListener("keydown", handleSkillActivityKeydown, true);
    window.addEventListener("message", handleAssetConsoleMessage);
    window.addEventListener("message", handleSkillConsoleMessage);
    window.addEventListener("resize", positionAssetConsolePanel);
    window.addEventListener("resize", positionSkillActivityTrigger);
    window.addEventListener("resize", positionSkillActivityPopover);
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", syncEmbeddedConsoleTheme);
    sync();
  }

  function destroy() {
    destroyed = true;
    closePromptDepthMenu();
    projectAppearanceAbortController.abort();
    closeProjectAppearancePicker();
    document.getElementById("codex-task-asset-composer-chips")?.remove();
    document.getElementById("codex-task-skill-composer-chips")?.remove();
    taskSkillRequestCleanup?.();
    observer?.disconnect();
    clearTimeout(syncTimer);
    document.removeEventListener("pointerover", scheduleSync, true);
    document.removeEventListener("click", handleCustomWorkspaceNavigation, true);
    document.removeEventListener("click", handleTopLevelNavigationSelection, true);
    document.removeEventListener("pointerdown", handleSkillActivityPointerDown, true);
    matchMedia("(prefers-color-scheme: dark)").removeEventListener?.("change", syncEmbeddedConsoleTheme);
    document.removeEventListener("keydown", handleAssetConsoleKeydown, true);
    document.removeEventListener("keydown", handleSkillActivityKeydown, true);
    window.removeEventListener("message", handleAssetConsoleMessage);
    window.removeEventListener("message", handleSkillConsoleMessage);
    window.removeEventListener("resize", positionAssetConsolePanel);
    window.removeEventListener("resize", positionSkillActivityTrigger);
    window.removeEventListener("resize", positionSkillActivityPopover);
    closeAssetConsolePanel({ notify: false, focusTarget: "none", destroy: true });
    document.getElementById(MAIN_CONSOLE_HOST_ID)?.remove();
    document.getElementById(WORKSPACE_DIM_OVERLAY_ID)?.remove();
    clearSkillOrganizer();
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(TOGGLE_ID)?.remove();
    document.getElementById(USAGE_ID)?.remove();
    document.getElementById(THREAD_OVERVIEW_RAIL_ID)?.remove();
    document.getElementById(SKILL_ACTIVITY_TRIGGER_ID)?.remove();
    document.getElementById(SKILL_ACTIVITY_POPOVER_ID)?.remove();
    document.querySelectorAll("[data-codex-prompt-depth-wrapper]").forEach((node) => node.remove());
    document.getElementById(PROMPT_DEPTH_MENU_ID)?.remove();
    clearHomeProjectShelf();
    clearProjectSidebarManager();
    clearShortcutEnhancement();
    document.querySelectorAll("[data-codex-local-console-entry]").forEach((node) => node.remove());
    clearSectionEnhancement();
    document.querySelectorAll(`[${SIDEBAR_NATIVE_HEADER_STABLE_ATTR}]`).forEach((node) => {
      node.removeAttribute(SIDEBAR_NATIVE_HEADER_STABLE_ATTR);
    });
    document.documentElement.removeAttribute("data-codex-conversation-view");
    document.documentElement.removeAttribute("data-codex-task-shell");
    document.documentElement.removeAttribute("data-codex-prompt-split-mode");
    document.documentElement.removeAttribute(CUSTOM_WORKSPACE_ATTR);
    document.documentElement.removeAttribute(COMPANY_WORKBENCH_MODE_ATTR);
    document.querySelectorAll(`.${SUMMARY_CLASS}, .${DETAILS_CLASS}, .${CARD_CONTENT_CLASS}`).forEach((node) => node.remove());
    document.querySelectorAll('[data-codex-conversation-preview-enhanced="true"]').forEach((row) => {
      row.removeAttribute("data-codex-conversation-preview-enhanced");
    });
    document.querySelectorAll('[data-codex-conversation-preview-title="true"]').forEach((node) => {
      node.removeAttribute("data-codex-conversation-preview-title");
    });
    document.querySelectorAll('[data-codex-conversation-card-grid="true"]').forEach((node) => {
      node.removeAttribute("data-codex-conversation-card-grid");
    });
    document.querySelectorAll('[data-codex-conversation-card-item="true"]').forEach((node) => {
      node.removeAttribute("data-codex-conversation-card-item");
    });
    document.querySelectorAll('[data-codex-sidebar-search-match="true"]').forEach((node) => {
      node.removeAttribute("data-codex-sidebar-search-match");
    });
    document.querySelectorAll('[data-codex-project-custom-icon="true"]').forEach((iconHost) => {
      iconHost.querySelector("[data-codex-project-custom-icon-overlay]")?.remove();
      iconHost.removeAttribute("data-codex-project-custom-icon");
      iconHost.removeAttribute("data-codex-project-icon-name");
      iconHost.style.removeProperty("--codex-project-icon-color");
    });
    document.querySelectorAll("[data-codex-project-appearance-bound]").forEach((row) => {
      row.removeAttribute("data-codex-project-appearance-bound");
    });
    if (window[SENTINEL]?.destroy === destroy) delete window[SENTINEL];
  }

  window[SENTINEL] = {
    destroy,
    refresh: sync,
    setPreviews,
    setThreadOverview,
    setSkillTrace,
    setSkillCatalog,
    setSkillDefaults,
    getDefaultSkillsTask: () => ({ threadId: normalizedThreadId(currentConversationThreadId()), entries: taskSkillCatalog?.entries || [] }),
    getPromptDepthTask: () => {
      const value = promptDepthForThread();
      return { threadId: promptDepthThreadId(), mode: value.workflow, complexity: value.complexity };
    },
    setPromptDepth: (result) => {
      const threadId = normalizedThreadId(result?.threadId);
      const mode = result?.mode;
      if (!threadId || !PROMPT_DEPTH_VALUES.includes(mode)) return;
      promptDepthByThread.set(threadId, {
        workflow: mode,
        complexity: PROMPT_COMPLEXITY_VALUES.includes(result?.complexity) ? result.complexity : "high",
      });
      persistPromptDepths();
      ensurePromptDepthControl();
    },
    setSearchCatalog,
    setUsage,
    setHomeProjects,
    setAssetConsole,
    setAssetConsolePanel,
    getHomeProjectsState,
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
