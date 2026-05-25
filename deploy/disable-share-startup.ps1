$ErrorActionPreference = 'SilentlyContinue'

$taskName = 'SmartClosetShare'
schtasks /Delete /TN $taskName /F | Out-Null

Write-Output "Startup task removed: $taskName"
