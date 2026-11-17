[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'Run this script in PowerShell 7.' }
$ghExe = (Get-Command gh -ErrorAction Stop).Source
$packageRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Invoke-Gh([string[]]$Arguments) {
    & $ghExe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "GitHub command failed: gh $($Arguments -join ' '). No checks or protections were bypassed." }
}
function Invoke-Git([string]$Root, [string[]]$Arguments) {
    git -C $Root @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Git command failed in $Root. Deployment stopped." }
}
function Wait-Route([string]$Url, [int]$ExpectedStatus, [int]$Minutes = 15) {
    $deadline = [DateTimeOffset]::UtcNow.AddMinutes($Minutes)
    do {
        try {
            $response = Invoke-WebRequest -Uri $Url -SkipHttpErrorCheck -TimeoutSec 20
            if ([int]$response.StatusCode -eq $ExpectedStatus) { Write-Host "Verified HTTP $ExpectedStatus : $Url"; return }
        } catch { Write-Host 'Waiting for the service to respond...' }
        Start-Sleep -Seconds 10
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw "Deployment was not verified: $Url did not return HTTP $ExpectedStatus. Check Azure pipeline/environment approvals."
}
function Wait-Mirror([string]$Repo, [string]$Sha) {
    for ($attempt = 0; $attempt -lt 18; $attempt++) {
        $runs = @(Invoke-Gh @('run', 'list', '--repo', $Repo, '--branch', 'main', '--commit', $Sha,
            '--workflow', 'mirror-to-azure.yml', '--json', 'databaseId,status,conclusion,url') | ConvertFrom-Json)
        if ($runs.Count) {
            $run = $runs[0]
            if ($run.status -ne 'completed') {
                Invoke-Gh @('run', 'watch', [string]$run.databaseId, '--repo', $Repo, '--exit-status', '--interval', '10') | Out-Host
            } elseif ($run.conclusion -ne 'success') { throw "Azure mirror failed: $($run.url)" }
            return
        }
        Start-Sleep -Seconds 10
    }
    throw "No Azure mirror run found for $Repo at $Sha."
}
function Publish-Release($Change) {
    $root = Join-Path $packageRoot $Change.Directory
    $expectedRemote = "https://github.com/$($Change.Repo).git"
    if ((Invoke-Git $root @('remote', 'get-url', 'origin')).Trim() -ne $expectedRemote) { throw "Unexpected remote: $root" }
    if (Invoke-Git $root @('status', '--porcelain')) { throw "Uncommitted changes in $root. Preserve/review them before deploying." }
    $headSha = (Invoke-Git $root @('rev-parse', $Change.Branch)).Trim()
    Invoke-Git $root @('push', '-u', 'origin', $Change.Branch) | Out-Host
    $found = @(Invoke-Gh @('pr', 'list', '--repo', $Change.Repo, '--head', $Change.Branch,
        '--base', 'main', '--state', 'all', '--json', 'number,state,url,headRefOid') | ConvertFrom-Json)
    $pr = $found | Where-Object { $_.state -eq 'OPEN' -or ($_.state -eq 'MERGED' -and $_.headRefOid -eq $headSha) } | Select-Object -First 1
    if (-not $pr) {
        $bodyFile = [IO.Path]::GetTempFileName()
        try {
            [IO.File]::WriteAllText($bodyFile, $Change.Body, [Text.UTF8Encoding]::new($false))
            Invoke-Gh @('pr', 'create', '--repo', $Change.Repo, '--base', 'main', '--head', $Change.Branch,
                '--title', $Change.Title, '--body-file', $bodyFile) | Out-Host
        } finally { Remove-Item -LiteralPath $bodyFile -ErrorAction SilentlyContinue }
        $pr = @(Invoke-Gh @('pr', 'list', '--repo', $Change.Repo, '--head', $Change.Branch,
            '--base', 'main', '--state', 'open', '--json', 'number,state,url') | ConvertFrom-Json) | Select-Object -First 1
    }
    if (-not $pr) { throw "Could not resolve the release PR for $($Change.Repo)." }
    Write-Host "Release PR: $($pr.url)"
    if ($pr.state -eq 'OPEN') {
        $checksFound = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            $detail = Invoke-Gh @('pr', 'view', [string]$pr.number, '--repo', $Change.Repo,
                '--json', 'headRefOid,statusCheckRollup') | ConvertFrom-Json
            if ($detail.headRefOid -ne $headSha) { throw 'The remote PR head changed. Review it before deploying.' }
            if (@($detail.statusCheckRollup | Where-Object { $_ }).Count) { $checksFound = $true; break }
            Start-Sleep -Seconds 10
        }
        if (-not $checksFound) { throw 'CI checks did not appear. No unchecked merge was performed.' }
        Invoke-Gh @('pr', 'checks', [string]$pr.number, '--repo', $Change.Repo, '--watch', '--fail-fast', '--interval', '10') | Out-Host
        # Normal merge only: required reviews, branch protections and failing checks remain enforced.
        Invoke-Gh @('pr', 'merge', [string]$pr.number, '--repo', $Change.Repo, '--merge', '--match-head-commit', $headSha) | Out-Host
    }
    $merged = Invoke-Gh @('pr', 'view', [string]$pr.number, '--repo', $Change.Repo, '--json', 'state,mergeCommit,url') | ConvertFrom-Json
    if ($merged.state -ne 'MERGED' -or -not $merged.mergeCommit.oid) { throw "Release not merged: $($merged.url)" }
    return $merged.mergeCommit.oid
}
function Wait-Vercel([string]$Sha) {
    $deadline = [DateTimeOffset]::UtcNow.AddMinutes(15)
    do {
        $deployments = @(Invoke-Gh @('api', "repos/GFA26SE63/FSCM-Frontend/deployments?sha=$Sha&per_page=10") | ConvertFrom-Json)
        foreach ($deployment in ($deployments | Where-Object environment -eq 'Production')) {
            $statuses = @(Invoke-Gh @('api', "repos/GFA26SE63/FSCM-Frontend/deployments/$($deployment.id)/statuses?per_page=1") | ConvertFrom-Json)
            $latest = $statuses | Select-Object -First 1
            if ($latest.state -in @('failure', 'error')) { throw "Vercel deployment failed: $($latest.log_url)" }
            if ($latest.state -eq 'success') {
                Write-Host "Vercel deployment: $($latest.environment_url)"
                return
            }
        }
        Start-Sleep -Seconds 10
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw 'Vercel production success has not been confirmed. Do not assume the site was deployed.'
}

Invoke-Gh @('auth', 'status', '--hostname', 'github.com') | Out-Host
$trace = @{
    Repo = 'GFA26SE63/FSCM-Traceability'; Directory = 'FSCM-Traceability'; Branch = 'release/factory-dispatches-20261117'
    Title = 'release: expose dispatched factory pallets for assigned warehouse receiving'
    Body = @'
Adds a service-key-protected dispatched-pallet list filtered by destination warehouse. Existing dispatch, manifest and receipt acknowledgement behavior is preserved. No schema migration.

Deploy this release before the FSCM receiving backend and portal releases. Validation: local Release build and factory UI regression checks; backend contract/query tests cover the new endpoint consumer.
'@
}
$backend = @{
    Repo = 'GFA26SE63/FSCM-Backend'; Directory = 'FSCM-Backend'; Branch = 'release/factory-inbound-20261117'
    Title = 'release: receive factory pallets using their fixed destination warehouse'
    Body = @'
Adds an assigned-warehouse arrivals queue and opens one receipt per selected factory pallet. The destination is derived from the external manifest; browser requests cannot choose it. Receipt retries reuse the source pallet key. Preview and receipt reject another pallet on a bound document. Locally received pallets are excluded while ACK delivery is pending. No schema migration.

Depends on the Traceability dispatch-list release. CI checks out its exact commit and enables the isolated PostgreSQL warehouse workflow tests. Local API/integration build and four directly invoked contract/query/role tests passed; full PostgreSQL verification must pass in CI before merge.
'@
}
$frontend = @{
    Repo = 'GFA26SE63/FSCM-Frontend'; Directory = 'FSCM-Frontend'; Branch = 'release/warehouse-screens-20261117'
    Title = 'release: separate warehouse screens and receive only assigned factory arrivals'
    Body = @'
Separates inbound, outbound, transfers and carton tracing into distinct menu entries and list/create/detail routes. Inbound starts from pending factory pallets; the destination and selected pallet are fixed. Single-warehouse keepers see a fixed warehouse; multi-warehouse selection filters the queue. Retains inspection, shortage/damage handling and stock posting semantics. Long document codes stay inside table columns. Aligns existing QR regression assertions with receipt-generated labels.

Requires the Traceability and backend receiving releases to be deployed first. Validation: local frontend tests, lint, build and browser checks using isolated fixture data. No environment files or credentials are part of the release.
'@
}

$sourceSha = Publish-Release $trace
Wait-Mirror $trace.Repo $sourceSha
Wait-Route 'https://fscm-traceability-ckeke3bwe6fahzhm.southeastasia-01.azurewebsites.net/api/integration/dispatches?warehouseIds=11111111-1111-1111-1111-111111111111' 401
Wait-Route 'https://fscm-traceability-ckeke3bwe6fahzhm.southeastasia-01.azurewebsites.net/health' 200 2

$backendSha = Publish-Release $backend
Wait-Mirror $backend.Repo $backendSha
Wait-Route 'https://app-fmcg-api-dev-e4f6bdg2h2bfehbq.southeastasia-01.azurewebsites.net/api/v1/warehouse-documents/factory-pending' 401
Wait-Route 'https://app-fmcg-api-dev-e4f6bdg2h2bfehbq.southeastasia-01.azurewebsites.net/health' 200 2

$frontendSha = Publish-Release $frontend
Wait-Vercel $frontendSha
$site = 'https://fscm-frontend.vercel.app'
$html = Invoke-WebRequest -Uri $site -TimeoutSec 30
$entry = [regex]::Match([string]$html.Content, 'src="([^\"]*/assets/index-[^\"]+\.js)"')
if (-not $entry.Success) { throw 'Could not identify the production frontend entry bundle.' }
$entryUrl = [Uri]::new([Uri]$site, $entry.Groups[1].Value).AbsoluteUri
$bundle = [string](Invoke-WebRequest -Uri $entryUrl -TimeoutSec 30).Content
if (-not $bundle.Contains('warehouse-inbound')) { throw 'Production alias does not serve the separated warehouse routes yet.' }
$feature = [regex]::Match($bundle, 'warehouse-work-[A-Za-z0-9_-]+\.js')
if (-not $feature.Success) { throw 'Could not verify the production warehouse chunk.' }
$featureBundle = [string](Invoke-WebRequest -Uri "$site/assets/$($feature.Value)" -TimeoutSec 30).Content
if (-not $featureBundle.Contains('factory-pending') -or -not $featureBundle.Contains('from-pallet')) { throw 'Production does not serve the new arrivals workflow.' }
Write-Host "DEPLOYED AND VERIFIED: $site"
Write-Host 'Traceability dispatch list, backend arrivals route and production portal assets are present.'
Write-Host 'No live warehouse stock was changed by this deployment verification.'
