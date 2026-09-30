$ErrorActionPreference = "Stop"

$taskName = "Procion Downdetector Collector"
$root = Split-Path -Parent $PSScriptRoot
$action = New-ScheduledTaskAction `
  -Execute $env:ComSpec `
  -Argument "/d /c npm.cmd run collect:downdetector:watch" `
  -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$principal = New-ScheduledTaskPrincipal `
  -UserId "$env:USERDOMAIN\$env:USERNAME" `
  -LogonType Interactive `
  -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description "Coleta somente o gráfico e as falhas agregadas da página pública da SEFAZ no Downdetector." `
  -Force | Out-Null

Write-Host "Tarefa '$taskName' instalada. Ela inicia no proximo logon."
