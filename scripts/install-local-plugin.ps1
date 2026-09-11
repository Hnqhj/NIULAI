param(
    [string]$PluginPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
$pluginJson = Join-Path $PluginPath '.codex-plugin\plugin.json'
if (-not (Test-Path -LiteralPath $pluginJson)) { throw "Plugin manifest not found: $pluginJson" }
$manifest = Get-Content -Raw -Encoding utf8 -LiteralPath $pluginJson | ConvertFrom-Json
if ($manifest.name -ne 'director-skill-console') { throw 'Unexpected plugin name.' }

$userPlugins = Join-Path $env:USERPROFILE 'plugins'
$marketplace = Join-Path $env:USERPROFILE '.agents\plugins\marketplace.json'
$target = Join-Path $userPlugins 'director-skill-console'
$plan = [ordered]@{ source = $PluginPath; target = $target; marketplace = $marketplace; action = 'copy plugin and update personal marketplace' }
if ($WhatIf) { $plan | ConvertTo-Json; exit 0 }

New-Item -ItemType Directory -Force -Path $userPlugins | Out-Null
if (Test-Path -LiteralPath $target) {
    $backup = "$target.backup-$(Get-Date -Format yyyyMMdd-HHmmss)"
    Copy-Item -LiteralPath $target -Destination $backup -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $target | Out-Null
Get-ChildItem -Force -LiteralPath $PluginPath |
    Where-Object { $_.Name -notin @('.state', 'data') } |
    Copy-Item -Destination $target -Recurse -Force
New-Item -ItemType Directory -Force -Path (Join-Path $target '.state'), (Join-Path $target 'data') | Out-Null

New-Item -ItemType Directory -Force -Path (Split-Path $marketplace) | Out-Null
if (Test-Path -LiteralPath $marketplace) {
    $catalog = Get-Content -Raw -Encoding utf8 -LiteralPath $marketplace | ConvertFrom-Json
} else {
    $catalog = [pscustomobject]@{ name = 'personal'; interface = [pscustomobject]@{ displayName = 'Personal' }; plugins = @() }
}
$entries = @($catalog.plugins | Where-Object { $_.name -ne 'director-skill-console' })
$entries += [pscustomobject]@{
    name = 'director-skill-console'
    source = [pscustomobject]@{ source = 'local'; path = './plugins/director-skill-console' }
    policy = [pscustomobject]@{ installation = 'AVAILABLE'; authentication = 'ON_INSTALL' }
    category = 'Productivity'
}
$catalog.plugins = $entries
$catalog | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $marketplace -Encoding utf8
Write-Output "Installed local plugin at $target"
Write-Output "Marketplace: $marketplace"
