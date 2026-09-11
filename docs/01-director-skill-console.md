# Director Skill Console

> 本地 Skill 注册、路由审计与运行状态服务，为导演工作流提供可追踪的技能基础设施。

项目地址：[https://github.com/Hnqhj/NIULAI](https://github.com/Hnqhj/NIULAI)

## 项目定位

Director Skill Console 是 NIULAI 项目中的技能服务层。它扫描本机可用的 `SKILL.md`，建立技能索引与依赖关系，保存显式运行事件，并通过本机 HTTP 服务向 Codex 增强器提供数据。

它只展示可验证的事实：技能文件、路由规则、显式事件和服务状态。它不会读取或猜测模型的隐藏思考，也不会把静态依赖图误认为真实执行记录。

## 核心能力

### 技能目录与搜索

- 递归扫描本地 `SKILL.md`。
- 解析技能名称、描述、分类、引用和显式依赖。
- 支持技能目录搜索和分类展示。
- 记录生成时间，便于判断目录是否需要刷新。

### 路由与依赖审计

- 检查唯一 Owner、未解析依赖、缺失引用和无效路径。
- 检查平台路由与提示词编译器选择。
- 检查镜头组时长、生成段连续性和交接链。
- 检查重复技能、重复编译和不符合当前 ExecutionPlan 的加载行为。

### 显式运行台账

运行状态来自明确写入的事件，而不是界面推断。支持 `discovered`、`matched`、`selected`、`loaded`、`running`、`handoff`、`validating`、`completed`、`skipped`、`blocked`、`retrying` 和 `failed`。

失败事件可以携带原因、消息、调用 ID、时间戳和来源路径，便于在任务页的技能活动控件中定位问题。

### 本地服务与事件流

默认服务地址为 `http://127.0.0.1:4187`。服务提供技能目录、运行概览、任务上下文和实时事件流；事件写入接口要求本机生成的 token。

## 安装与运行

要求 Node.js 20 或更高版本。

```powershell
npm install
npm test
npm run seed
npm start
```

启动后打开：`http://127.0.0.1:4187/`

如果由 Codex 插件启动，服务默认会自动拉起；设置 `SKILL_CONSOLE_AUTOSTART=0` 可以关闭自动启动。

## 写入一条真实事件

```powershell
.\scripts\emit-event.ps1 `
  -RunId task-001 `
  -Skill script-camera-group-router `
  -Status running `
  -OwnerSurface intent `
  -Message '开始路由'
```

事件写入只接受 `.state/event-token` 中的本机 token。服务不会把任务、素材、Skill 内容或 token 上传到远程服务器。

## MCP 与 Codex 集成

`.mcp.json` 注册本地 MCP 服务，支持技能目录、运行状态、路由规划、任务上下文、提示词预检和编译状态查询。脚本来源于仓库内的 `src/`、`mcp/`、`lib/` 和 `skills/`，不依赖特定用户目录。

脚本派生任务遵循以下链路：

```text
TaskEnvelope → ExecutionPlan → RouteReceipt → ResearchReceipt（需要时）
→ GovernanceState → StoryContract → ContinuityContract
→ InformationLedger → SpaceContract → ShotLedger
→ CameraGroupPlan → GenerationSegmentPlan → PlatformPromptSet
→ QCReport → OutputReview → RetryPlan
```

`fast`、`standard`、`full` 只改变后台处理深度；最终对用户的交付格式保持一致。每次生成前应执行 prompt preflight，避免过期路由设置绕过校验。

## 数据与隐私边界

- 默认只监听回环地址 `127.0.0.1`。
- `.state/` 和运行数据不纳入 Git 提交。
- 事件台账只保存显式状态，不保存隐藏推理。
- 技能控制台为只读展示；不会修改或删除 Skill 文件。
- 本地安装、卸载和回滚应保留已有配置、台账和素材。

## 常用命令

```powershell
npm test
npm run scan
npm run audit
npm run audit-delivery -- path\to\delivery-root
npm run route-plan -- path\to\routing-features.json
npm run validate-state -- path\to\orchestration-state.json
```

## 项目结构

| 目录 | 作用 |
| --- | --- |
| `src/` | 本地服务、索引、审计、路由与状态逻辑 |
| `mcp/` | Codex MCP 工具入口 |
| `lib/` | 预览、任务上下文、安装配置与运行数据模块 |
| `skills/` | 可安装的 Codex Skill 说明 |
| `config/` | 路由契约与状态 schema |
| `scripts/` | 启动、事件写入、安装与桌面增强器适配脚本 |
| `test/` | 路由、审计、台账、技能索引和工作流布局测试 |

## 许可证

MIT
