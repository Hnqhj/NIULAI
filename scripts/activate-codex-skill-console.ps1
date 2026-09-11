param(
  [int]$Port = 9232,
  [string]$EnhancerDir = (Join-Path $env:LOCALAPPDATA "Programs\Codex Sidebar Enhancer"),
  [string]$StateDir = (Join-Path $env:LOCALAPPDATA "CodexSidebarEnhancer")
)

$ErrorActionPreference = "Stop"
$launch = Join-Path $EnhancerDir "windows\launch.ps1"
if (-not (Test-Path -LiteralPath $launch -PathType Leaf)) {
  throw "Enhancer not found: $EnhancerDir"
}

$sync = Join-Path $PSScriptRoot "sync-sidebar-adapter.ps1"
if (Test-Path -LiteralPath $sync -PathType Leaf) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $sync -EnhancerDir $EnhancerDir
  if ($LASTEXITCODE -ne 0) { throw "Sidebar adapter sync failed." }
}

try {
  Invoke-RestMethod -Uri "http://127.0.0.1:4187/api/health" -TimeoutSec 2 | Out-Null
} catch {
  $root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  $server = Join-Path $root "src\server.js"
  if (Test-Path -LiteralPath $server) {
    $node = (Get-Command node -ErrorAction Stop).Source
    Start-Process -FilePath $node -ArgumentList "`"$server`"" -WorkingDirectory $root -WindowStyle Hidden | Out-Null
    Start-Sleep -Milliseconds 500
  }
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launch -Port $Port -InstallDir $EnhancerDir -StateDir $StateDir
if ($LASTEXITCODE -ne 0) {
  Write-Error "Activation failed. Exit Codex fully and retry."
  exit $LASTEXITCODE
}

Write-Output "Skill Console activated. Open the Skill Console shortcut in the Codex sidebar or visit http://127.0.0.1:4187/."
