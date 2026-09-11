param(
  # 图标来源 PNG；使用 DeskBox 中的启动器图标
  [string]$IconPath = 'F:\DeskBox\Administrator\DeskBox\9990598dd78ee5afc1d1a6eedd64f52726720591.png',
  [string]$OutName = '牛来.exe',
  [switch]$CopyToDesktop,
  [string]$ProjectRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot 'build'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$icoPath = Join-Path $outDir 'launcher.ico'

function Convert-PngToIco {
  param([string]$SourcePng, [string]$TargetIco)

  $source = [System.Drawing.Image]::FromFile($SourcePng)
  try {
    $sizes = @(16, 24, 32, 48, 64, 128, 256)
    $pngs = @()
    foreach ($size in $sizes) {
      $bmp = New-Object System.Drawing.Bitmap($size, $size)
      $graphics = [System.Drawing.Graphics]::FromImage($bmp)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.DrawImage($source, 0, 0, $size, $size)
      $graphics.Dispose()
      $stream = New-Object System.IO.MemoryStream
      $bmp.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
      $bmp.Dispose()
      $pngs += , @{ Size = $size; Data = $stream.ToArray() }
      $stream.Dispose()
    }

    $output = New-Object System.IO.MemoryStream
    $writer = New-Object System.IO.BinaryWriter($output)
    # ICONDIR
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$pngs.Count)
    $offset = 6 + 16 * $pngs.Count
    foreach ($entry in $pngs) {
      $size = $entry.Size
      $writer.Write([byte]($(if ($size -ge 256) { 0 } else { $size })))
      $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
      $writer.Write([uint16]1); $writer.Write([uint16]32)
      $writer.Write([uint32]$entry.Data.Length)
      $writer.Write([uint32]$offset)
      $offset += $entry.Data.Length
    }
    foreach ($entry in $pngs) { $writer.Write($entry.Data) }
    $writer.Flush()
    [IO.File]::WriteAllBytes($TargetIco, $output.ToArray())
    $writer.Dispose(); $output.Dispose()
  } finally {
    $source.Dispose()
  }
}

function New-FallbackIcon {
  param([string]$TargetIco)

  # 桌面 PNG 不存在时的兜底图标：深色圆角方块 + 蓝色 play 三角
  $size = 256
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bmp)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $rect = New-Object System.Drawing.Rectangle(16, 16, 224, 224)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.Color]::FromArgb(24, 26, 31), [System.Drawing.Color]::FromArgb(44, 48, 58), 90)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $radius = 56
  $path.AddArc($rect.X, $rect.Y, $radius, $radius, 180, 90)
  $path.AddArc($rect.Right - $radius, $rect.Y, $radius, $radius, 270, 90)
  $path.AddArc($rect.Right - $radius, $rect.Bottom - $radius, $radius, $radius, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $radius, $radius, $radius, 90, 90)
  $path.CloseFigure()
  $graphics.FillPath($brush, $path)
  $triangle = @(
    (New-Object System.Drawing.PointF(96, 76)),
    (New-Object System.Drawing.PointF(96, 180)),
    (New-Object System.Drawing.PointF(184, 128))
  )
  $graphics.FillPolygon([System.Drawing.Brushes]::White, $triangle)
  $graphics.Dispose()

  $tempPng = Join-Path $env:TEMP ('codex-launcher-icon-' + [IO.Path]::GetRandomFileName() + '.png')
  $bmp.Save($tempPng, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  try { Convert-PngToIco -SourcePng $tempPng -TargetIco $TargetIco } finally { Remove-Item $tempPng -Force -ErrorAction SilentlyContinue }
}

if (Test-Path -LiteralPath $IconPath -PathType Leaf) {
  Convert-PngToIco -SourcePng $IconPath -TargetIco $icoPath
  Write-Output "图标已从 PNG 生成：$IconPath"
} else {
  New-FallbackIcon -TargetIco $icoPath
  Write-Warning "未找到图标 PNG（$IconPath），已使用兜底图标。把 PNG 放到桌面后重新运行本脚本即可替换。"
}

$csc = Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $csc -PathType Leaf)) { $csc = Join-Path $env:SystemRoot 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (-not (Test-Path -LiteralPath $csc -PathType Leaf)) { throw '未找到 csc.exe（.NET Framework）' }

$exePath = Join-Path $outDir $OutName
& $csc /nologo /target:winexe /out:"$exePath" /win32icon:"$icoPath" (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw "csc 编译失败" }

if ($CopyToDesktop) {
  $desktop = [Environment]::GetFolderPath('Desktop')
  Copy-Item -LiteralPath $exePath -Destination (Join-Path $desktop $OutName) -Force
  Write-Output "已复制到桌面：$(Join-Path $desktop $OutName)"
}

Write-Output "构建完成：$exePath"
