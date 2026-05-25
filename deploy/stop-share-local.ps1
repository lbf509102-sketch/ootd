$ErrorActionPreference = 'SilentlyContinue'

$projectRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $projectRoot '.tmp-cloudflared.pid'

if (Test-Path $pidFile) {
  $pidValue = Get-Content $pidFile
  if ($pidValue) {
    Get-Process -Id $pidValue | Stop-Process -Force
  }
  Remove-Item $pidFile -Force
}

Write-Output 'Tunnel stopped.'
