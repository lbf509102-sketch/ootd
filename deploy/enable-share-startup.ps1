$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$taskName = 'SmartClosetShare'
$scriptPath = Join-Path $projectRoot 'deploy\start-share-local.ps1'

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""

$trigger = New-ScheduledTaskTrigger -AtLogOn

try {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
} catch {
}

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Description 'Start Smart Closet local sharing tunnel on logon.' | Out-Null

Write-Output "Startup task created: $taskName"
