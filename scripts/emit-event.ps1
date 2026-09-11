param(
    [Parameter(Mandatory = $true)][string]$RunId,
    [Parameter(Mandatory = $true)][string]$Skill,
    [Parameter(Mandatory = $true)][ValidateSet('discovered','matched','selected','loaded','running','handoff','validating','completed','skipped','blocked','retrying','failed')][string]$Status,
    [string]$TaskId = $RunId,
    [string]$TaskTitle = 'Codex task',
    [string]$OwnerSurface = '',
    [string]$Phase = '',
    [string]$Message = '',
    [string]$Reason = '',
    [int]$Port = 4187
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$tokenPath = Join-Path $projectRoot '.state\event-token'
if (-not (Test-Path -LiteralPath $tokenPath)) {
    throw 'Skill Console is not initialized. Start the service once before emitting events.'
}
$token = (Get-Content -Raw -LiteralPath $tokenPath).Trim()
$body = @{
    runId = $RunId
    taskId = $TaskId
    taskTitle = $TaskTitle
    skill = $Skill
    status = $Status
    ownerSurface = $OwnerSurface
    phase = $Phase
    message = $Message
    reason = $Reason
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$Port/api/events" -Headers @{ 'x-skill-console-token' = $token } -ContentType 'application/json; charset=utf-8' -Body $body
