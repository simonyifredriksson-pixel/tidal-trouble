# run.ps1 - run a tools/*.mjs script under VS Code's Electron as Node.
#   .\tools\run.ps1 render_sticks.mjs <args...>
# There is no npm on this machine; Electron ships the Node runtime we need.
param(
  [Parameter(Mandatory = $true)][string]$Script,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)
$root = Split-Path -Parent $PSScriptRoot
$code = "C:\Users\46709\AppData\Local\Programs\Microsoft VS Code\Code.exe"
$out = Join-Path $env:TEMP "tt_out.txt"
$err = Join-Path $env:TEMP "tt_err.txt"
$path = Join-Path $root "tools\$Script"
if (-not (Test-Path $path)) { Write-Output "no such script: $path"; exit 1 }

$argList = @("`"$path`"")
foreach ($a in $Rest) { $argList += "`"$a`"" }

$env:ELECTRON_RUN_AS_NODE = 1
$p = Start-Process -FilePath $code -ArgumentList $argList -NoNewWindow -Wait -PassThru `
  -RedirectStandardOutput $out -RedirectStandardError $err
Get-Content $out -ErrorAction SilentlyContinue
$e = Get-Content $err -Raw -ErrorAction SilentlyContinue
if ($e -and $e.Trim().Length -gt 0) { Write-Output "--- stderr ---"; Write-Output $e }
if ($p.ExitCode -ne 0) { Write-Output "EXIT $($p.ExitCode)" }
exit $p.ExitCode
