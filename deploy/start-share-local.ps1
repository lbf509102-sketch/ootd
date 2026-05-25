$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$cloudflaredPath = "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe"
$tunnelLog = Join-Path $projectRoot '.tmp-cloudflared.out.log'
$tunnelErrLog = Join-Path $projectRoot '.tmp-cloudflared.err.log'
$pidFile = Join-Path $projectRoot '.tmp-cloudflared.pid'

if (-not (Test-Path $cloudflaredPath)) {
  throw "cloudflared not found at $cloudflaredPath"
}

if (-not (Test-Path (Join-Path $projectRoot 'dist'))) {
  Push-Location $projectRoot
  try {
    npm run build
  }
  finally {
    Pop-Location
  }
}

if (-not (Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList '--env-file=.env','server/index.mjs' -WorkingDirectory $projectRoot -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

if (Test-Path $pidFile) {
  $oldPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($oldPid) {
    Get-Process -Id $oldPid -ErrorAction SilentlyContinue | Stop-Process -Force
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Remove-Item $tunnelLog -Force -ErrorAction SilentlyContinue
Remove-Item $tunnelErrLog -Force -ErrorAction SilentlyContinue

$process = Start-Process -FilePath $cloudflaredPath `
  -ArgumentList 'tunnel','--url','http://127.0.0.1:3001' `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $tunnelLog `
  -RedirectStandardError $tunnelErrLog `
  -PassThru

$process.Id | Set-Content $pidFile

$publicUrl = ''
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $tunnelLog -or Test-Path $tunnelErrLog) {
    $paths = @()
    if (Test-Path $tunnelLog) { $paths += $tunnelLog }
    if (Test-Path $tunnelErrLog) { $paths += $tunnelErrLog }
    $match = Select-String -Path $paths -Pattern 'https://[-a-zA-Z0-9]+\.trycloudflare\.com' -AllMatches -ErrorAction SilentlyContinue
    if ($match) {
      $publicUrl = $match.Matches[-1].Value
      break
    }
  }
}

if (-not $publicUrl) {
  throw "Tunnel started but public URL was not found. Check $tunnelLog"
}

Write-Output "Share URL:"
Write-Output $publicUrl
