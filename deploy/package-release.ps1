$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseDir = Join-Path $projectRoot 'release'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stageDir = Join-Path $releaseDir "smart-closet-$stamp"
$zipPath = Join-Path $releaseDir "smart-closet-$stamp.zip"

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
if (Test-Path $stageDir) {
  Remove-Item -LiteralPath $stageDir -Recurse -Force
}
if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null

$topFiles = @(
  '.env.production.example',
  '.dockerignore',
  '.gitignore',
  'Dockerfile',
  'ecosystem.config.cjs',
  'eslint.config.js',
  'index.html',
  'package-lock.json',
  'package.json',
  'tsconfig.app.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts'
)

foreach ($file in $topFiles) {
  $source = Join-Path $projectRoot $file
  if (Test-Path $source) {
    Copy-Item -LiteralPath $source -Destination $stageDir -Force
  }
}

$simpleDirs = @('deploy', 'public', 'src')
foreach ($dir in $simpleDirs) {
  $source = Join-Path $projectRoot $dir
  if (Test-Path $source) {
    Copy-Item -LiteralPath $source -Destination $stageDir -Recurse -Force
  }
}

$serverSource = Join-Path $projectRoot 'server'
$serverDest = Join-Path $stageDir 'server'
New-Item -ItemType Directory -Force -Path $serverDest | Out-Null

Get-ChildItem -LiteralPath $serverSource -Force | ForEach-Object {
  if ($_.PSIsContainer) {
    if ($_.Name -in @('uploads')) { return }
    $dest = Join-Path $serverDest $_.Name
    Copy-Item -LiteralPath $_.FullName -Destination $dest -Recurse -Force
    return
  }
  Copy-Item -LiteralPath $_.FullName -Destination $serverDest -Force
}

$dbCleanup = @(
  (Join-Path $serverDest 'data\app.db'),
  (Join-Path $serverDest 'data\app.db-shm'),
  (Join-Path $serverDest 'data\app.db-wal')
)

foreach ($target in $dbCleanup) {
  if (Test-Path $target) {
    Remove-Item -LiteralPath $target -Force
  }
}

Compress-Archive -Path (Join-Path $stageDir '*') -DestinationPath $zipPath -Force
Remove-Item -LiteralPath $stageDir -Recurse -Force

Write-Output "Release package created:"
Write-Output $zipPath
