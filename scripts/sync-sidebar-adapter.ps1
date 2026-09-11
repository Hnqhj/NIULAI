param(
  [string]$EnhancerDir = (Join-Path $env:LOCALAPPDATA "Programs\Codex Sidebar Enhancer")
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$files = @(
  @{ Source = (Join-Path $root "integrations\injector-skill-console.mjs"); Destination = (Join-Path $EnhancerDir "scripts\injector.mjs") },
  @{ Source = (Join-Path $root "integrations\cdp-client.mjs"); Destination = (Join-Path $EnhancerDir "scripts\cdp-client.mjs") },
  @{ Source = (Join-Path $root "integrations\conversation-preview.user.js"); Destination = (Join-Path $EnhancerDir "inject\conversation-preview.user.js") },
  @{ Source = (Join-Path $root "integrations\launch-store-app.ps1"); Destination = (Join-Path $EnhancerDir "windows\launch.ps1") },
  @{ Source = (Join-Path $root "lib\preview-data.mjs"); Destination = (Join-Path $EnhancerDir "lib\preview-data.mjs") },
  @{ Source = (Join-Path $root "lib\task-context-store.mjs"); Destination = (Join-Path $EnhancerDir "lib\task-context-store.mjs") },
  @{ Source = (Join-Path $root "lib\card-view.mjs"); Destination = (Join-Path $EnhancerDir "lib\card-view.mjs") },
  @{ Source = (Join-Path $root "lib\install-config.mjs"); Destination = (Join-Path $EnhancerDir "lib\install-config.mjs") },
  @{ Source = (Join-Path $root "asset-console\public\app.js"); Destination = (Join-Path $EnhancerDir "asset-console\public\app.js") },
  @{ Source = (Join-Path $root "asset-console\public\asset-classification.js"); Destination = (Join-Path $EnhancerDir "asset-console\public\asset-classification.js") },
  @{ Source = (Join-Path $root "asset-console\public\index.html"); Destination = (Join-Path $EnhancerDir "asset-console\public\index.html") },
  @{ Source = (Join-Path $root "asset-console\public\ui-v3.css"); Destination = (Join-Path $EnhancerDir "asset-console\public\ui-v3.css") },
  @{ Source = (Join-Path $root "asset-browser\server.js"); Destination = (Join-Path $EnhancerDir "asset-browser\server.js") },
  @{ Source = (Join-Path $root "asset-browser\server.cjs"); Destination = (Join-Path $EnhancerDir "asset-browser\server.cjs") },
  @{ Source = (Join-Path $root "asset-browser\package.json"); Destination = (Join-Path $EnhancerDir "asset-browser\package.json") },
  @{ Source = (Join-Path $root "asset-browser\database.js"); Destination = (Join-Path $EnhancerDir "asset-browser\database.js") }
)
foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file.Source -PathType Leaf)) { throw "缺少适配文件：$($file.Source)" }
  $destinationDir = Split-Path -Parent $file.Destination
  if (-not (Test-Path -LiteralPath $destinationDir)) { New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null }
  Copy-Item -LiteralPath $file.Source -Destination $file.Destination -Force
}
# Older Windows installs use the legacy AssetBrowser service outside the
# enhancer directory. Keep its public shell in sync while the asset workspace
# is being rebuilt; no user state or service data is touched.
$legacyAssetPublic = Join-Path $env:LOCALAPPDATA "AssetBrowser\public"
if (Test-Path -LiteralPath $legacyAssetPublic -PathType Container) {
  foreach ($name in @("app.js", "index.html", "ui-v3.css")) {
    Copy-Item -LiteralPath (Join-Path $root "asset-console\public\$name") -Destination (Join-Path $legacyAssetPublic $name) -Force
  }
}
# Some Windows installs keep the same asset shell under the standalone Codex
# Asset Console directory. Keep that public shell in sync as well.
$standaloneAssetPublic = Join-Path $env:LOCALAPPDATA "Programs\Codex Asset Console\asset-console\public"
if (Test-Path -LiteralPath $standaloneAssetPublic -PathType Container) {
  foreach ($name in @("app.js", "index.html", "ui-v3.css")) {
    Copy-Item -LiteralPath (Join-Path $root "asset-console\public\$name") -Destination (Join-Path $standaloneAssetPublic $name) -Force
  }
}
Write-Output "已同步技能控制台侧栏适配器到 $EnhancerDir"
