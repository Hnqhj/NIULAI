param(
  [int]$Port = 9232,
  [string]$InstallDir = (Split-Path -Parent $PSScriptRoot),
  [string]$StateDir = (Join-Path $env:LOCALAPPDATA "CodexSidebarEnhancer")
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
$launcherLog = Join-Path $StateDir "launcher.log"

function Write-LauncherLog([string]$Message) {
  Add-Content -LiteralPath $launcherLog -Value "$(Get-Date -Format o) $Message" -Encoding utf8
}

function Test-LocalPort([int]$Number) {
  foreach ($address in @("127.0.0.1", "::1")) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
      $task = $client.ConnectAsync($address, $Number)
      if ($task.Wait(500) -and $client.Connected) { return $true }
    } catch {
    } finally {
      $client.Dispose()
    }
  }
  return $false
}

function Test-CodexDebugPort([int]$Number) {
  foreach ($address in @("127.0.0.1", "[::1]")) {
    try {
      $targets = Invoke-RestMethod -Uri "http://$address`:$Number/json/list" -TimeoutSec 1
      $codexTarget = @($targets) | Where-Object { $_.type -eq "page" -and $_.url -like "app://-/index.html*" } | Select-Object -First 1
      if ($codexTarget) { return $true }
    } catch {
    }
  }
  $debugArg = "--remote-debugging-port=$Number"
  return [bool](Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -eq "ChatGPT.exe" -and $_.CommandLine -like "*$debugArg*"
  })
  
}

function Start-CodexWithDebug([string]$AppUserModelId, [string]$Arguments) {
  if (-not ('CodexAppActivation' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CodexAppActivation {
  [ComImport, Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C"), ClassInterface(ClassInterfaceType.None)]
  class Manager {}
  [ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IManager {
    int ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string appUserModelId, [MarshalAs(UnmanagedType.LPWStr)] string arguments, uint options, out uint processId);
    int ActivateForFile([MarshalAs(UnmanagedType.LPWStr)] string appUserModelId, IntPtr itemArray, [MarshalAs(UnmanagedType.LPWStr)] string verb, out uint processId);
    int ActivateForProtocol([MarshalAs(UnmanagedType.LPWStr)] string appUserModelId, IntPtr itemArray, out uint processId);
  }
  public static uint Start(string appUserModelId, string arguments) {
    var manager = (IManager)(object)new Manager();
    uint processId;
    int hr = manager.ActivateApplication(appUserModelId, arguments, 0, out processId);
    if (hr < 0) Marshal.ThrowExceptionForHR(hr);
    return processId;
  }
}
'@
  }
  return [CodexAppActivation]::Start($AppUserModelId, $Arguments)
}

try {
  & (Join-Path $PSScriptRoot "start-injector.ps1") -Port $Port -InstallDir $InstallDir -StateDir $StateDir

  $package = Get-AppxPackage -Name "OpenAI.Codex" -ErrorAction Stop | Sort-Object Version -Descending | Select-Object -First 1
  $codexExe = Join-Path $package.InstallLocation "app\ChatGPT.exe"
  if (-not (Test-Path -LiteralPath $codexExe -PathType Leaf)) { throw "Codex executable not found" }

  if (Test-LocalPort $Port) {
    if (-not (Test-CodexDebugPort $Port)) {
      throw "Port $Port is already in use by another application"
    }
    $appId = "$($package.PackageFamilyName)!App"
    [void](Start-CodexWithDebug -AppUserModelId $appId -Arguments "")
    Write-LauncherLog "Activated an existing enhanced Codex instance."
    exit 0
  }

  # The Store app may expose the debugger on ::1 while the TCP probe above is
  # still warming up. If the main process already carries our port argument,
  # attach to that instance instead of treating it as an unmodified launch.
  $debugArg = "--remote-debugging-port=$Port"
  $debugProcess = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -eq "ChatGPT.exe" -and $_.CommandLine -like "*$debugArg*"
  } | Select-Object -First 1
  if ($debugProcess) {
    $appId = "$($package.PackageFamilyName)!App"
    [void](Start-CodexWithDebug -AppUserModelId $appId -Arguments "")
    Write-LauncherLog "Activated Codex debug process on loopback port $Port."
    exit 0
  }

  $mainProcesses = @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq "ChatGPT.exe" -and
    $_.ExecutablePath -like "*OpenAI.Codex*" -and
    $_.CommandLine -notmatch "--type=" -and
    $_.ProcessId -eq (Get-Process -Name ChatGPT -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1 -ExpandProperty Id)
  })
  if ($mainProcesses) {
    throw "检测到 Codex 已在运行，但它没有开启调试端口。请先完全退出 Codex，再重新启动增强器。"
  }

  $appId = "$($package.PackageFamilyName)!App"
  $debugArgs = "--remote-debugging-address=127.0.0.1 --remote-debugging-port=$Port --remote-allow-origins=http://127.0.0.1:$Port --enable-features=LocalNetworkAccessForSubframeNavigationsWarningOnly"
  [void](Start-CodexWithDebug -AppUserModelId $appId -Arguments $debugArgs)

  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline -and -not (Test-CodexDebugPort $Port)) {
    Start-Sleep -Milliseconds 250
  }
  if (-not (Test-CodexDebugPort $Port)) { throw "Codex did not open a valid local debugging target" }
  Write-LauncherLog "Started Codex with the sidebar enhancer on loopback port $Port."
} catch {
  Write-LauncherLog "ERROR: $($_.Exception.Message)"
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(
    "启动失败。详情已记录到：`n$launcherLog",
    "Codex 侧栏增强器",
    "OK",
    "Error"
  ) | Out-Null
  exit 1
}
