param(
  [switch]$NoBrowser,
  [ValidateRange(1024, 65535)][int]$Port = 4173,
  [string]$DataDirectory = ''
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  throw '未找到 Node.js。请先安装 Node.js 22.12 或更高版本，再双击启动。'
}
$nodeVersion = & $nodeCommand.Source -p 'process.versions.node'
if ($LASTEXITCODE -ne 0 -or [version]$nodeVersion -lt [version]'22.12.0') {
  throw 'Node.js 版本过低，请安装 22.12 或更高版本。'
}

# Keep local testing on this computer, even in a shell with deployment variables.
foreach ($name in @('DATABASE_URL', 'NETLIFY_DB_URL', 'NETLIFY_DB_DRIVER', 'NETLIFY', 'AWS_LAMBDA_FUNCTION_NAME', 'BACKUP_WEBHOOK_URL', 'BACKUP_WEBHOOK_TOKEN')) {
  [Environment]::SetEnvironmentVariable($name, $null, 'Process')
}
if (-not $DataDirectory) { $DataDirectory = Join-Path $PSScriptRoot '.data' }
if (-not [IO.Path]::IsPathRooted($DataDirectory)) { $DataDirectory = Join-Path $PSScriptRoot $DataDirectory }
$env:DATA_DIR = [IO.Path]::GetFullPath($DataDirectory)
$env:PORT = [string]$Port
$env:TEYVAT_PROJECT_ROOT = $PSScriptRoot
$siteUrl = "http://127.0.0.1:$Port"

# Hold one cross-process lock per data directory, including while starting up.
$hasher = [Security.Cryptography.SHA256]::Create()
try {
  $directoryBytes = [Text.Encoding]::UTF8.GetBytes($env:DATA_DIR.TrimEnd('\', '/').ToLowerInvariant())
  $directoryHash = [BitConverter]::ToString($hasher.ComputeHash($directoryBytes)).Replace('-', '')
} finally { $hasher.Dispose() }
$launchMutex = New-Object Threading.Mutex($false, "Local\TeyvatLocal-$directoryHash")
$hasLock = $false
try {
  try { $hasLock = $launchMutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $hasLock = $true }
  if (-not $hasLock) {
    Write-Host '网站正在启动或已经运行，无需重复开启。请保留先打开的启动窗口。' -ForegroundColor Green
    if (-not $NoBrowser) {
      try {
        $existing = Invoke-RestMethod -Uri "$siteUrl/api/status" -TimeoutSec 2
        if ($existing.local -eq $true -and $null -ne $existing.PSObject.Properties['needsSetup']) {
          $destination = if ($existing.needsSetup) { "$siteUrl/setup" } else { $siteUrl }
          Start-Process -FilePath $destination
        }
      } catch {}
    }
    return
  }

$connection = New-Object Net.Sockets.TcpClient
try {
  $connection.Connect('127.0.0.1', $Port)
  $portOccupied = $true
} catch {
  $portOccupied = $false
} finally {
  $connection.Dispose()
}
if ($portOccupied) {
  try { $status = Invoke-RestMethod -Uri "$siteUrl/api/status" -TimeoutSec 5 } catch { $status = $null }
  if ($null -ne $status -and $status.local -eq $true -and $null -ne $status.PSObject.Properties['needsSetup']) {
    Write-Host "网站已经在运行：$siteUrl" -ForegroundColor Green
    if (-not $NoBrowser) {
      $openUrl = if ($status.needsSetup) { "$siteUrl/setup" } else { $siteUrl }
      Start-Process -FilePath $openUrl
    }
    return
  }
  throw "端口 $Port 已被其他程序占用。请关闭占用程序后重试，或使用 -Port 指定其他端口。"
}

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules'))) {
  Write-Host '首次运行，正在安装依赖，请保持联网并稍候……'
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw '依赖安装失败，请检查网络后重新双击启动。' }
}

Write-Host ''
Write-Host '提瓦特旅行手册 · 本地测试' -ForegroundColor Cyan
Write-Host "网站地址：$siteUrl"
Write-Host "数据保存在：$env:DATA_DIR"
Write-Host '请保持这个窗口打开；按 Ctrl+C 停止网站。以后双击启动即可继续使用。'
Write-Host '站长登录后可在“管理工作台 → 记忆相簿”测试图片功能。'
Write-Host ''

$browserJob = $null
try {
  if (-not $NoBrowser) {
    $browserJob = Start-Job -ArgumentList $siteUrl -ScriptBlock {
      param($url)
      for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try {
          $ready = Invoke-RestMethod -Uri "$url/api/status" -TimeoutSec 1
          if ($ready.local -eq $true -and $null -ne $ready.PSObject.Properties['needsSetup']) {
            $destination = if ($ready.needsSetup) { "$url/setup" } else { $url }
            Start-Process -FilePath $destination
            return
          }
        } catch {}
        Start-Sleep -Milliseconds 500
      }
    }
  }
  & $nodeCommand.Source 'server/local.mjs'
  if ($LASTEXITCODE -ne 0) { throw '网站启动失败，请查看上方错误信息。' }
} finally {
  if ($browserJob) {
    Stop-Job -Job $browserJob -ErrorAction SilentlyContinue
    Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
  }
}
} finally {
  if ($hasLock) { $launchMutex.ReleaseMutex() }
  $launchMutex.Dispose()
}
