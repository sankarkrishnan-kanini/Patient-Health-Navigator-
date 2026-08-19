#requires -Version 5.1
param(
  [Parameter(Mandatory)][string]$RunId,
  [Parameter(Mandatory)][string]$StepId,
  [Parameter(Mandatory)][string]$Decision,
  [Parameter(Mandatory)][string]$Actor,
  [Parameter(ValueFromRemainingArguments)][string[]]$Artifacts
)

$ErrorActionPreference = 'SilentlyContinue'

# Function to return graceful JSON response
function Return-Response {
    param(
        [string]$Status,
        [string]$Action,
        [string]$Reason,
        [string]$PrUrl = 'null',
        [string]$Sha = 'null'
    )

    $timestamp = (Get-Date -AsUTC -Format 'o')
    $response = @{
        status = $Status
        action = $Action
        reason = $Reason
        pr_url = if ($PrUrl -eq 'null') { $null } else { $PrUrl }
        sha = if ($Sha -eq 'null') { $null } else { $Sha }
        actor = $Actor
        timestamp = $timestamp
    } | ConvertTo-Json -Compress

    Write-Output $response
    exit 0
}

# Check 1: Is this a git repository?
$gitDir = Test-Path ".git" -PathType Container
if (-not $gitDir) {
    Return-Response "success" "skipped" "no_git_repository"
}

# Check 2: Are there any artifacts?
if (-not $Artifacts -or $Artifacts.Count -eq 0) {
    Return-Response "success" "skipped" "no_artifacts_to_commit"
}

# Check 3: Does gh CLI exist?
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Return-Response "success" "skipped" "gh_cli_not_found"
}

$AutoMerge = $env:AUTO_MERGE -eq 'true'
$Base = if ($env:BASE) { $env:BASE } else { 'main' }
$Branch = "propel/$RunId/$StepId"

# Check 4: Are there any changes?
$status = & git status --porcelain 2>$null
if ([string]::IsNullOrWhiteSpace($status)) {
    Return-Response "success" "skipped" "no_changes_to_commit"
}

# Try to create/checkout branch
try {
    & git checkout -b $Branch 2>$null
    if ($LASTEXITCODE -ne 0) {
        & git checkout $Branch 2>$null
        if ($LASTEXITCODE -ne 0) {
            Return-Response "success" "skipped" "branch_creation_failed"
        }
    }
}
catch {
    Return-Response "success" "skipped" "branch_checkout_error"
}

# Try to stage artifacts
try {
    & git add -- @Artifacts 2>$null
    if ($LASTEXITCODE -ne 0) {
        Return-Response "success" "skipped" "artifact_staging_failed"
    }
}
catch {
    Return-Response "success" "skipped" "artifact_staging_error"
}

# Try to commit
try {
    & git commit -m "propel($StepId): $Decision by $Actor [run:$RunId]" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Return-Response "success" "skipped" "commit_failed"
    }
}
catch {
    Return-Response "success" "skipped" "commit_error"
}

# Get commit SHA
$CommitSha = & git rev-parse HEAD 2>$null
if (-not $CommitSha) {
    $CommitSha = "unknown"
}

# Try to push
try {
    & git push -u origin $Branch 2>$null
    if ($LASTEXITCODE -ne 0) {
        Return-Response "success" "committed" "push_failed_but_committed" "null" $CommitSha
    }
}
catch {
    Return-Response "success" "committed" "push_failed_but_committed" "null" $CommitSha
}

# Try to create/view PR
$PrUrl = "null"
try {
    $prCreate = & gh pr create --base $Base --head $Branch `
      --title "Propel $StepId - $RunId" `
      --body "Approved by $Actor. Run: $RunId. Artifacts: $($Artifacts -join ', ')" 2>$null

    if ($prCreate) {
        $PrUrl = $prCreate
    } else {
        $prView = & gh pr view $Branch --json url -q .url 2>$null
        if ($prView) {
            $PrUrl = $prView
        }
    }
}
catch {
    # PR creation failed, continue
}

# Try to auto-merge if configured
$Merged = "false"
if ($AutoMerge -and $PrUrl -ne "null") {
    try {
        & gh pr merge $PrUrl --squash --auto --delete-branch 2>$null
        if ($LASTEXITCODE -eq 0) {
            $Merged = "queued"
        }
    }
    catch {
        # Auto-merge failed, continue
    }
}

# Always return success
[pscustomobject]@{
    status = "success"
    action = "commit"
    reason = "committed"
    pr_url = if ($PrUrl -eq "null") { $null } else { $PrUrl }
    sha = $CommitSha
    merged = $Merged
    actor = $Actor
    timestamp = (Get-Date -AsUTC -Format 'o')
} | ConvertTo-Json -Compress
exit 0
