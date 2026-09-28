# publish.ps1 - upload this folder to the GitHub Pages repo in one commit.
#
#   Right-click this file -> "Run with PowerShell"   (or: .\tools\publish.ps1)
#
# It asks for a GitHub token in a hidden prompt; the token is used for this
# one upload and never written anywhere. Files are only added or replaced,
# never deleted (so .nojekyll and anything else on GitHub stays).
param(
  [string]$Repo = 'simonyifredriksson-pixel/tidal-trouble',
  [string]$Branch = 'main',
  [string]$Message = 'Update the game'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# re-stamp the module versions first, so browsers pick up the new code
if (Get-Command node -ErrorAction SilentlyContinue) { node tools/stamp.mjs }

# the token: from GITHUB_TOKEN for this one run if it is set, otherwise a hidden prompt
$auto = [bool]$env:GITHUB_TOKEN
if ($auto) { $token = $env:GITHUB_TOKEN }
else {
  $sec = Read-Host 'Paste your GitHub token (it will not be shown)' -AsSecureString
  $token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
}
# a hidden prompt takes Ctrl+V as a literal control character, and a paste can bring a stray newline or space
$token = $token -replace '[\x00-\x20\x7F]', ''
if ($token.Length -lt 20) { Write-Host "`nThat did not look like a token. Paste it with a RIGHT-CLICK in this window (Ctrl+V does not paste here), then press Enter." -ForegroundColor Yellow; Read-Host 'Press Enter to close'; exit 1 }
$h = @{ Authorization = "Bearer $token"; 'User-Agent' = 'tidaltrouble-publish'; Accept = 'application/vnd.github+json' }
$api = "https://api.github.com/repos/$Repo"

$ref = Invoke-RestMethod "$api/git/ref/heads/$Branch" -Headers $h
$head = Invoke-RestMethod "$api/git/commits/$($ref.object.sha)" -Headers $h
$remote = @{}
foreach ($e in (Invoke-RestMethod "$api/git/trees/$($head.tree.sha)?recursive=1" -Headers $h).tree) { if ($e.type -eq 'blob') { $remote[$e.path] = $e.sha } }

# only upload what actually changed (compare git blob hashes)
$sha1 = [Security.Cryptography.SHA1]::Create()
$entries = @()
Get-ChildItem -Recurse -File | Where-Object { $_.FullName -notmatch '\\\.claude\\|\\\.git\\' } | ForEach-Object {
  $rel = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
  $bytes = [IO.File]::ReadAllBytes($_.FullName)
  $hdr = [Text.Encoding]::ASCII.GetBytes("blob $($bytes.Length)`0")
  $sha = ([BitConverter]::ToString($sha1.ComputeHash($hdr + $bytes)) -replace '-', '').ToLower()
  if ($remote[$rel] -eq $sha) { return }
  Write-Host "  uploading $rel"
  $blob = Invoke-RestMethod "$api/git/blobs" -Method Post -Headers $h -ContentType 'application/json' -Body (@{ content = [Convert]::ToBase64String($bytes); encoding = 'base64' } | ConvertTo-Json)
  $script:entries += @{ path = $rel; mode = '100644'; type = 'blob'; sha = $blob.sha }
}
if (-not $entries.Count) { Write-Host 'Nothing has changed - GitHub is already up to date.'; if (-not $auto) { Read-Host 'Press Enter to close' }; exit }

$tree = Invoke-RestMethod "$api/git/trees" -Method Post -Headers $h -ContentType 'application/json' -Body (@{ base_tree = $head.tree.sha; tree = $entries } | ConvertTo-Json -Depth 5)
$commit = Invoke-RestMethod "$api/git/commits" -Method Post -Headers $h -ContentType 'application/json' -Body (@{ message = $Message; tree = $tree.sha; parents = @($ref.object.sha) } | ConvertTo-Json)
Invoke-RestMethod "$api/git/refs/heads/$Branch" -Method Patch -Headers $h -ContentType 'application/json' -Body (@{ sha = $commit.sha } | ConvertTo-Json) | Out-Null
$token = $null
Write-Host "`nDone: $($entries.Count) files uploaded. GitHub Pages will update in a few minutes." -ForegroundColor Green
if (-not $auto) { Read-Host 'Press Enter to close' }
