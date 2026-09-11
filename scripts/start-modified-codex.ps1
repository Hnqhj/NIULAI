param(
  [int]$Port = 9232,
  [switch]$CreateDesktopShortcut
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$activate = Join-Path $PSScriptRoot "activate-codex-skill-console.ps1"
$sync = Join-Path $PSScriptRoot "sync-sidebar-adapter.ps1"
$enhancerDir = Join-Path $env:LOCALAPPDATA "Programs\Codex Sidebar Enhancer"
$stateDir = Join-Path $env:LOCALAPPDATA "CodexSidebarEnhancer"
$stopInjector = Join-Path $enhancerDir "windows\stop-injector.ps1"

function Test-PortBusy([int]$Number) {
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync('127.0.0.1', $Number)
    return $task.Wait(250) -and $client.Connected
  } catch { return $false }
  finally { $client.Dispose() }
}

function Find-DebugPort([int]$Start) {
  for ($candidate = $Start; $candidate -le ($Start + 20); $candidate++) {
    if (-not (Test-PortBusy $candidate)) { return $candidate }
  }
  throw "No free Codex debug port found."
}

function Test-DebugCodex {
  foreach ($address in @("127.0.0.1", "[::1]")) {
    try {
      $targets = Invoke-RestMethod -Uri "http://$address`:$Port/json/list" -TimeoutSec 1
      if (@($targets) | Where-Object { $_.type -eq 'page' -and $_.url -like 'app://-/index.html*' }) { return $true }
    } catch { }
  }
  return $false
}

function Test-DebugProcess([int]$Number) {
  $debugArg = "--remote-debugging-port=$Number"
  return [bool](Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -eq "ChatGPT.exe" -and $_.CommandLine -like "*$debugArg*"
  })
}

if (-not (Test-DebugCodex) -and -not (Test-DebugProcess $Port)) {
  $Port = Find-DebugPort $Port
}

if ($CreateDesktopShortcut) {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $shortcutPath = Join-Path $desktop 'Start Modified Codex.lnk'
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`""
  $shortcut.WorkingDirectory = $root
  $shortcut.IconLocation = 'F:\DeskBox\Administrator\DeskBox\9990598dd78ee5afc1d1a6eedd64f52726720591.png'
  $shortcut.Description = '启动带技能控制台的 Codex'
  $shortcut.Save()
  Write-Output "桌面快捷方式已创建：$shortcutPath"
  exit 0
}

if (-not (Test-Path -LiteralPath $activate -PathType Leaf)) {
  throw "未找到激活脚本：$activate"
}

if (Test-Path -LiteralPath $stopInjector -PathType Leaf) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $stopInjector -InstallDir $enhancerDir -StateDir $stateDir
}

$mainCodex = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -eq 'ChatGPT.exe' -and $_.CommandLine -notmatch '--type='
})
if ($mainCodex.Count -gt 0) {
  if (Test-DebugCodex) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $activate -Port $Port -EnhancerDir $enhancerDir -StateDir $stateDir
    exit $LASTEXITCODE
  }
  Add-Type -AssemblyName PresentationFramework
  $result = [System.Windows.MessageBox]::Show(
    "Codex is running without the modified startup. Save your work and close it now?",
    "Modified Codex",
    "YesNo",
    "Warning"
  )
  if ($result -ne 'Yes') { exit 2 }
  foreach ($item in $mainCodex) {
    $process = Get-Process -Id $item.ProcessId -ErrorAction SilentlyContinue
    if ($process) { [void]$process.CloseMainWindow() }
  }
  $deadline = (Get-Date).AddSeconds(12)
  do {
    Start-Sleep -Milliseconds 250
    $remaining = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
      $_.Name -eq 'ChatGPT.exe' -and $_.CommandLine -notmatch '--type='
    })
  } while ($remaining.Count -gt 0 -and (Get-Date) -lt $deadline)
  if ($remaining.Count -gt 0) {
    [System.Windows.MessageBox]::Show("Codex did not exit. Close it from the taskbar, then try again.", "Modified Codex", "OK", "Error") | Out-Null
    exit 3
  }
  $debugArg = "--remote-debugging-port=$Port"
  return [bool](Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -eq "ChatGPT.exe" -and $_.CommandLine -like "*$debugArg*"
  })
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $activate -Port $Port -EnhancerDir $enhancerDir -StateDir $stateDir
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
