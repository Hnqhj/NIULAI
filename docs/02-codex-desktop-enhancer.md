# 牛来.exe / Codex Desktop Enhancer

> 将 Codex 桌面端的任务侧栏、技能入口、项目图标和单对话技能活动连接成一个可追踪的本地工作台。

项目地址：[https://github.com/Hnqhj/NIULAI](https://github.com/Hnqhj/NIULAI)

## 它改造什么

增强器通过 Chromium DevTools Protocol 注入本地脚本，围绕 Codex 原生界面增加能力，不修改 ChatGPT/Codex 应用包，也不替换整套原生导航。

当前仓库包含四个用户可见能力：

1. **技能页面**：搜索、分类、收藏和查看本地技能。
2. **对话路由按钮**：从原生侧栏进入新对话、Pull Request、定时安排、插件、技能和资产入口。
3. **项目图标**：为侧栏项目设置图标和颜色，并持久化到本机。
4. **单对话技能活动**：只在任务对话页显示当前对话调用过的 Skill、进行中状态和失败原因。

## 关键行为

### 任务页与原生页面隔离

卡片/列表视图、任务摘要、提示词控制和技能活动只在实际任务对话页启用。插件、技能页、资产库、项目管理、Pull Request、定时安排和组合技工作区不会获得任务页的技能活动轨道。

技能入口在侧栏统一显示为“技能”；技能管理页面不再提供独立的可视化画布，实时状态以任务页的单对话技能活动为准。

### 原生导航保留

增强器将固定控件放在正常布局流中，滚动内容从固定控件下方开始。原生按钮仍由 Codex 处理点击和导航，增强器只同步状态、增加入口和清理过期增强标记。

### 单对话技能活动

注入器从本地服务读取 Codex session 的实时快照，按当前任务和当前 conversation ID 过滤技能事件。活动控件展示：

- 当前对话调用的技能数量。
- `running`、`completed`、`failed` 等状态。
- 失败原因或重试后恢复信息。
- 数据源连接状态和最近同步时间。

没有明确 session 事件时显示“尚未检测到技能调用”，不会根据静态技能目录伪造调用记录。

## Windows 安装与启动

### 推荐：牛来.exe

将仓库完整目录保留在本机，双击：

```text
launcher\build\牛来.exe
```

启动器会调用 `scripts\start-modified-codex.ps1`，同步适配文件、确保本地技能服务运行、启动注入器，并通过 Windows Store 应用激活接口启动带调试端口的 Codex。

如果 Codex 已经以普通模式运行，请先保存工作并完全退出，再启动牛来.exe。启动器不会删除任务、素材或配置。

### PowerShell 启动

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\start-modified-codex.ps1
```

默认调试端口为 `9232`。如果端口已被占用，脚本会在相邻端口中寻找可用端口。

### 重新构建牛来.exe

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\launcher\build-launcher-exe.ps1 `
  -OutName '牛来.exe'
```

启动器只寻找自身目录下的 `scripts\start-modified-codex.ps1`，因此发布给其他用户时应保留仓库目录结构，不要只单独分发 exe。

## 适配器安装位置

运行同步脚本后，增强器运行文件位于：

```text
%LOCALAPPDATA%\Programs\Codex Sidebar Enhancer
```

状态、日志和注入器 PID 位于：

```text
%LOCALAPPDATA%\CodexSidebarEnhancer
```

资产服务默认使用 `127.0.0.1:5177`；技能服务使用 `127.0.0.1:4187`。端口和路径属于本机适配层，不能作为远程服务地址暴露。

## 支持范围

- 主要支持 Windows Store 版 Codex 桌面应用。
- 需要 Node.js 22 或更高版本运行注入器。
- 适配器依赖 Codex 当前 DOM 结构；Codex 大版本更新后可能需要更新选择器。
- ChatGPT 桌面端只有在提供兼容的 Chromium 调试端口和相同导航结构时才可能复用，不能把它承诺为所有版本的通用兼容。

## 安全与隐私

- 注入器通过本机 CDP 连接当前 Codex 渲染器。
- 本地服务只监听回环地址。
- 资产 API 使用安装时生成的随机 token。
- 资产路径校验只接受绝对 Windows 路径或有效 UNC 路径。
- 选择资产只把路径写入当前输入框，不自动提交或发送消息。
- 关闭面板会清理 iframe、事件监听、代理和临时会话。
- 安装、同步和卸载只操作产品拥有的目录。

## 验证

```powershell
node --check .\integrations\conversation-preview.user.js
node --check .\integrations\injector-skill-console.mjs
node --check .\public\app.js
npm test
```

任务页回归应覆盖：卡片/列表切换、新对话、插件、Pull Request、定时安排、资产库、项目图标、技能活动打开与关闭，以及返回原任务后的状态恢复。

## 项目结构

| 路径 | 作用 |
| --- | --- |
| `integrations/conversation-preview.user.js` | Codex 页面注入脚本 |
| `integrations/injector-skill-console.mjs` | CDP 注入器、事件同步和本地代理 |
| `integrations/cdp-client.mjs` | CDP 连接与 Runtime.evaluate 封装 |
| `asset-console/` | 资产控制台前端 |
| `asset-browser/` | 本地资产服务适配 |
| `launcher/` | 牛来.exe 源码与构建脚本 |
| `scripts/` | 启动、同步、安装和回归脚本 |
| `public/` | 技能管理页面与静态资源 |

## 许可证

MIT
