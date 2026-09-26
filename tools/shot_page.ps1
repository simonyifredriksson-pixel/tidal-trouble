# shot_page.ps1 - photograph any page of this project in a real browser.
#
# The generalisation of shot_boot3d.ps1, and it carries the same three
# hard-won rules: an ABSOLUTE --screenshot path (a relative one is written
# somewhere the shell cannot see and looks like a silent failure), a FRESH
# --user-data-dir (Chrome otherwise hands off to the desktop browser and
# exits 0 having done nothing, and caches the ES modules so the shot is of
# yesterday's code), and enough virtual time for the fonts and the module
# graph to land.
#
#   tools\shot_page.ps1 -Url "/_uishot.html?catch=0.63" -Out <dir> -Name fight
param(
  [Parameter(Mandatory = $true)][string]$Url,
  [string]$Out = $env:TEMP,
  [string]$Name = 'page',
  [int]$W = 1280,
  [int]$H = 720,
  # Chrome's virtual clock runs timers as fast as it can, so a long budget
  # does not mean "wait longer", it means "simulate further". The catch
  # card dismisses itself after eleven seconds and a sixteen-second budget
  # photographed the empty screen after it had gone.
  [int]$Budget = 16000
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { throw "no Chrome at $chrome" }

$live = $false
try { Invoke-WebRequest -Uri "http://127.0.0.1:8741/" -UseBasicParsing -TimeoutSec 3 | Out-Null; $live = $true } catch { }
$srv = $null
if (-not $live) {
  $srv = Start-Process -FilePath 'python' -ArgumentList '-m', 'http.server', '8741' -WorkingDirectory $root -PassThru -WindowStyle Hidden
  Start-Sleep -Milliseconds 900
}

$ud = Join-Path $env:TEMP ("tt_cud_" + [guid]::NewGuid().ToString('N').Substring(0, 8))
try {
  $png = Join-Path (Resolve-Path $Out) "$Name.png"
  if (Test-Path $png) { Remove-Item $png -Force }
  $a = @('--headless=new', "--user-data-dir=$ud", '--no-first-run', '--incognito',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    "--virtual-time-budget=$Budget", "--window-size=$W,$H",
    "--screenshot=$png", "http://127.0.0.1:8741$Url")
  $p = Start-Process -FilePath $chrome -ArgumentList $a -NoNewWindow -Wait -PassThru
  if (Test-Path $png) { "$png  $([int]((Get-Item $png).Length/1024))KB" }
  else { "NO IMAGE (chrome exit $($p.ExitCode))" }
} finally {
  if ($srv) { try { Stop-Process -Id $srv.Id -Force -ErrorAction Stop } catch { } }
  if (Test-Path $ud) { try { Remove-Item $ud -Recurse -Force -ErrorAction Stop } catch { } }
}
