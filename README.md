# Director Skill Console

Phase-one local core for visual Skill management and truthful task routing status.

## Included

- Recursive local `SKILL.md` registry and search
- Skill-to-Skill dependency graph
- Missing owner, unresolved dependency, missing reference, duration, and platform-routing audit
- Optional formal-delivery audit for manifest paths/hashes and duplicate files
- Explicit event ledger for task status; no hidden-reasoning inference
- Read-only local dashboard bound to `127.0.0.1`
- Authenticated local event write endpoint

## Run

```powershell
npm test
npm run seed
npm start
```

Open `http://127.0.0.1:4187`.

When Codex starts the plugin MCP server, it checks this local service and starts it in the background when needed. Set `SKILL_CONSOLE_AUTOSTART=0` to disable this behavior.

## Emit a real event

Start the service once, then call:

```powershell
.\scripts\emit-event.ps1 -RunId task-001 -Skill ai-video-prompt-director -Status running -OwnerSurface intent -Message '开始路由'
```

## Activate in Codex

The personal marketplace entry is registered at `%USERPROFILE%\.agents\plugins\marketplace.json`, and the plugin source is installed at `%USERPROFILE%\plugins\director-skill-console`. Codex picks up the plugin after reinstalling it from the personal marketplace and starting a new task/thread. The local dashboard itself can be opened at `http://127.0.0.1:4187/`.

The event API accepts only the token generated under `.state/event-token`. The dashboard cannot write, edit, disable, or delete Skills in phase one.

### 激活侧栏技能控制台

1. 完全退出 Codex（任务列表中不再有 `ChatGPT.exe` 主进程）。
2. 将增强器适配文件同步到 `%LOCALAPPDATA%\\Programs\\Codex Sidebar Enhancer`。
3. 运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\activate-codex-skill-console.ps1
```

脚本使用 Windows Store 支持的应用激活接口启动 Codex，并传入本地调试端口 `9232`。成功后在左侧快捷入口中点击“技能控制台”；如果不需要侧栏，也可以直接打开 `http://127.0.0.1:4187/`。

### 桌面一键启动

桌面已创建“启动改造版 Codex.exe”（原生 exe，双击无黑窗口）。它会自动同步侧栏适配器、检查 Skill Console 服务并启动改造版 Codex。若 Codex 已带调试端口运行，则直接激活现有实例；若 Codex 在无调试端口下运行，程序会提示先保存并完全退出，再次双击即可。

重新构建 exe（图标默认取桌面上的 `389e4e8752ceeff5c9bfffb44a482f4a26720591.png`，找不到时用内置兜底图标）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\launcher\build-launcher-exe.ps1 -CopyToDesktop
# 指定其他图标：-IconPath <png 路径>
```

如仍需旧的 PowerShell 快捷方式：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-modified-codex.ps1 -CreateDesktopShortcut
```

## Status semantics

- `discovered`: present in the registry
- `matched`: trigger conditions matched
- `selected`: selected by the route
- `loaded`: current instructions were read
- `running`: actively producing its owned decision
- `handoff`: output is being handed to the next owner
- `validating`: checking an assembled result
- `completed`, `skipped`, `blocked`, `retrying`, `failed`: terminal or exception states

Only explicit events are shown as runtime truth. Static mentions are shown only in the dependency graph.

## Orchestration contract v6

The console follows the shared director-workflow state chain:

```text
TaskEnvelope -> ExecutionPlan -> RouteReceipt -> ResearchReceipt (conditional)
-> GovernanceState -> StoryContract
-> ContinuityContract -> InformationLedger -> SpaceContract -> ShotLedger
-> CameraGroupPlan -> GenerationSegmentPlan -> PlatformPromptSet -> QCReport
-> OutputReview (when generated output exists) -> RetryPlan (when retry is needed)
```

Each specialist owns one control surface and returns a `TASK_CARD` with a named
`state_patch_request`; it must not silently replace another specialist's full
draft. The active `delivery_contract` determines timing:

- `liu_camera_group`: 14-28 seconds per group, never over 30;
- `generic_seedance_clip`: 4-15 seconds;
- `storyboard_only`: no forced generation duration.

`script-camera-group-router` is the only implicit script-to-camera-group entry
and writes the deterministic `ExecutionPlan` before heavy Skills load.
`narrative-camera-groups` owns group boundaries and visible delivery,
`professional-storyboard-director` owns the human shot table, the selected
platform compiler owns the single final syntax pass, and exactly one matching
preflight profile owns pass/block decisions. Standard uses
`camera-group-preflight-standard`; full alone uses
`ai-video-prompt-preflight`.

Every script-derived input routes to camera groups with a human-readable shot
table and one detailed six-part prompt per group. Complete scripts use global
grouping; local fragments use scoped local grouping. A CameraGroup is a director
planning unit; GenerationSegment is a platform submission unit and defaults to
1:1 unless a model-limit, complexity, or continuity reason is recorded.

The director selects `processing_depth` automatically: `fast` only for
low-risk local/single-scene material, `standard` by default, and `full` for
action, VFX, complex continuity/references, research, commercial delivery, or
result-driven retries. Depth changes backstage work only; visible delivery is
identical at all depths.

The fast route is fixed to four Skills, including the router. All routes set
`max_prompt_compile_count=1`, forbid unselected compilers, and reuse one
`ResearchReceipt` when current-fact research is necessary.
The standard route is fixed to five Skills: router, lightweight standard
director, camera-group packager, one platform compiler, and standard preflight.
The 86 KB full director and separate camera/material/sound owners load only on
`full`.

Every `ExecutionPlan` also carries a context policy: downstream Skills consume
approved state slices and field patches, reuse one reference/research receipt,
do not replay the full transcript, and run one review per owner. This reduces
avoidable context and review duplication without changing the six-part delivery.

Preview the deterministic route before loading Skills:

```powershell
npm run route-plan -- path\to\routing-features.json
```

Before submitting a script-derived prompt for generation, call the MCP tool
`skill_console_prompt_preflight`. It rereads the active task's workflow and
description-complexity settings, selects the platform compiler, and returns
`ready`, `blocked`, or `not_applicable` with machine-readable issues. The
`skill_console_compile_prompt` tool uses the same preflight and refuses a
blocked prompt, so a stale workflow setting cannot silently reach generation.
Successful script-derived compilation writes a bounded `PromptCompilationReceipt`
back to the active task context. Use `skill_console_prompt_compilation_status`
to distinguish `compiled`, `stale`, and `uncompiled`; non-script tasks return
`not_applicable`.
When a user-selected `fast` or `standard` workflow overrides a detected
high-risk signal, the resulting `ExecutionPlan` records `depth_override` and
`override_risk_signals` for review. Platform selection is resolved before the
fast route, so Jimeng continues to use `jimeng-sd2-prompting`.

Validate a runtime state file with:

```powershell
npm run validate-state -- path\to\orchestration-state.json
```

Audit a formal delivery directory with:

```powershell
npm run audit-delivery -- path\to\delivery-root [path\to\manifest.json]
```

Every `ShotLedger` item includes `group_id`; shot timecodes are checked from
zero independently inside each camera group.

## Codex 侧栏入口（第二阶段）

Skill Console 可通过 Codex Workspace Enhancer 作为当前任务绑定的嵌入面板打开。增强器使用一次性令牌和受限本地代理转发到 `127.0.0.1:4187`，不会修改 Codex 原生文件，也不会创建第二个可见窗口。入口名称为“技能控制台”，任务切换时旧面板上下文会被清理。

增强器运行文件位于 `%LOCALAPPDATA%\\Programs\\Codex Sidebar Enhancer`。若侧栏没有出现入口，请使用该目录下 `windows\\launch.ps1` 启动带调试端口的 Codex；Windows Store 版 Codex 若拒绝命令行启动，需要改用桌面快捷方式或重新安装可调试启动的版本。
