[CmdletBinding()]
param([switch]$Deploy)

$ErrorActionPreference = 'Stop'
$frontendRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path (Split-Path -Parent $frontendRoot) 'FSCM-Backend'
function Assert-Success([string]$Action) {
    if ($LASTEXITCODE -ne 0) { throw "$Action failed. See the command output above." }
}
gh auth status --hostname github.com
Assert-Success 'GitHub authentication (run in your signed-in Windows PowerShell)'

$changes = @(
    @{
        Repo = 'GFA26SE63/FSCM-Backend'; Path = $backendRoot
        Branch = 'chore/report-demo-seed-20261112'; Base = 'develop'
        Title = 'chore: add verified monthly demo seed for operations reports'
        Body = @'
Adds an explicit CLI to seed labelled DEMO data for redemption, loyalty and promotion reports. Uses a single transaction, a monthly idempotency marker and verifies all three report projections before committing. Existing business records and inventory are not updated. This tool is run manually and is not part of API startup.

Validation: .NET 10 build passed. Database access from the authoring environment is blocked, so a live database dry-run was not completed. Usage and safeguards are documented in tools/FSCM.ReportDemoSeed/README.md.
'@
    },
    @{
        Repo = 'GFA26SE63/FSCM-Frontend'; Path = $frontendRoot
        Branch = 'fix/report-promo-ui-release-20261112'; Base = 'main'
        Title = 'fix: overview report navigation and promotion selection dialogs'
        Body = @'
Moves redemption, loyalty and promotion reports into the Overview sidebar group and removes the duplicate dashboard buttons. Report navigation follows the URL, including Back/Forward, and highlights the selected report.

Promotion product and customer sections each show one selected-items table with Add opening a searchable multi-select dialog. Apply commits selections; Cancel, Escape and backdrop dismiss them. Existing per-SKU quantity and discount rules are retained when adding products.

Validation: full frontend tests, lint and production build passed. Browser E2E assertions were updated but have not been run in the restricted authoring environment.

Release: this branch starts from production main and contains only these changes. vercel.json enables deployment only for main. No environment files or credentials are included. No database migration is required for these UI changes.
'@
    }
)

$frontendPr = $null
foreach ($change in $changes) {
    if (-not (Test-Path -LiteralPath $change.Path)) { throw "Repository folder not found: $($change.Path)" }
    $remote = (git -C $change.Path remote get-url origin).Trim()
    Assert-Success 'Read repository remote'
    $expected = "https://github.com/$($change.Repo).git"
    if ($remote -ne $expected) { throw "Unexpected remote for $($change.Path); expected $expected" }
    git -C $change.Path push -u origin $change.Branch
    Assert-Success "Push $($change.Repo)"
    $foundJson = gh pr list --repo $change.Repo --head $change.Branch --base $change.Base --state all --json url,state
    Assert-Success 'Read existing PRs'
    $found = @($foundJson | ConvertFrom-Json) | Where-Object { $_.state -in @('OPEN', 'MERGED') } | Select-Object -First 1
    if ($found) { $prUrl = $found.url }
    else {
        $bodyFile = [IO.Path]::GetTempFileName()
        try {
            [IO.File]::WriteAllText($bodyFile, $change.Body, [Text.UTF8Encoding]::new($false))
            $prUrl = gh pr create --repo $change.Repo --base $change.Base --head $change.Branch `
                --reviewer haibeu2901 --title $change.Title --body-file $bodyFile
            Assert-Success "Create PR for $($change.Repo)"
            $prUrl = ($prUrl | Select-Object -Last 1).Trim()
        }
        finally { Remove-Item -LiteralPath $bodyFile -ErrorAction SilentlyContinue }
    }
    Write-Host "PR: $prUrl"
    if ($change.Repo -eq 'GFA26SE63/FSCM-Frontend') { $frontendPr = $prUrl }
}

if (-not $Deploy) {
    Write-Host 'PRs are ready for Hai. Use -Deploy to wait for checks, merge the frontend PR into main and verify Vercel production.'
    exit 0
}

$detailJson = gh pr view $frontendPr --json state,baseRefName,mergeCommit
Assert-Success 'Read frontend PR state'
$detail = $detailJson | ConvertFrom-Json
if ($detail.baseRefName -ne 'main') { throw 'Deploy only supports the reviewed production main target.' }
if ($detail.state -eq 'OPEN') {
    gh pr checks $frontendPr --watch --fail-fast --interval 10
    Assert-Success 'Frontend CI checks (no checks or a failed check stops deployment)'
    # Do not bypass required reviews, branch protection or failed checks.
    gh pr merge $frontendPr --squash
    Assert-Success 'Merge frontend release into main'
}
elseif ($detail.state -ne 'MERGED') { throw 'Frontend PR is closed without merging.' }
$detailJson = gh pr view $frontendPr --json mergeCommit
Assert-Success 'Read production merge commit'
$sha = ($detailJson | ConvertFrom-Json).mergeCommit.oid
if (-not $sha) { throw 'Production merge is not complete; no deployment claimed.' }
for ($attempt = 1; $attempt -le 30; $attempt++) {
    Write-Host "Checking Vercel production for $sha ($attempt/30)..."
    $json = gh api "repos/GFA26SE63/FSCM-Frontend/deployments?sha=$sha&environment=Production&per_page=5"
    Assert-Success 'Read Vercel deployment records'
    foreach ($deployment in @($json | ConvertFrom-Json)) {
        $statusesJson = gh api "repos/GFA26SE63/FSCM-Frontend/deployments/$($deployment.id)/statuses?per_page=1"
        Assert-Success 'Read Vercel deployment status'
        $status = @($statusesJson | ConvertFrom-Json) | Select-Object -First 1
        if ($status.state -eq 'success') {
            Write-Host "DEPLOYED: $($status.environment_url)"
            Write-Host "Frontend PR: $frontendPr"
            exit 0
        }
        if ($status.state -in @('failure', 'error')) { throw "Vercel deployment failed. See $($status.log_url)" }
    }
    Start-Sleep -Seconds 10
}
throw 'Main has been merged, but Vercel production success was not confirmed within five minutes. Inspect deployment status before retrying.'
