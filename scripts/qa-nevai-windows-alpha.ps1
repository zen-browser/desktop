param(
  [string]$DistBin = ""
)

$ErrorActionPreference = "Stop"

function Fail($Message) {
  Write-Error $Message
  exit 1
}

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

function Find-DistBin {
  $applicationIni = Get-ChildItem -Path (Join-Path $Root "engine") -Recurse -Filter application.ini -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match "\\dist\\bin\\application\.ini$" } |
    Sort-Object FullName |
    Select-Object -Last 1

  if ($null -eq $applicationIni) {
    return ""
  }

  return $applicationIni.Directory.FullName
}

if ([string]::IsNullOrWhiteSpace($DistBin)) {
  $DistBin = Find-DistBin
}

if ([string]::IsNullOrWhiteSpace($DistBin)) {
  Fail "Could not find Windows dist/bin output. Run Windows build discovery first."
}

if (!(Test-Path -LiteralPath $DistBin -PathType Container)) {
  Fail "Missing dist/bin directory: $DistBin"
}

$ApplicationIni = Join-Path $DistBin "application.ini"
if (!(Test-Path -LiteralPath $ApplicationIni -PathType Leaf)) {
  Fail "Missing application.ini in $DistBin"
}

Write-Host "== Nevai Windows alpha QA =="
Write-Host "dist/bin: $DistBin"

Write-Host ""
Write-Host "== application.ini identity =="
$IniLines = Get-Content -LiteralPath $ApplicationIni
$IniLines | Where-Object { $_ -match "^(Vendor|Name|RemotingName|Profile|EnableProfileMigrator)=" } | ForEach-Object { Write-Host $_ }

if (!($IniLines -contains "Vendor=Nevai")) {
  Fail "application.ini Vendor is not Nevai"
}

if (!($IniLines -contains "Name=Nevai")) {
  Fail "application.ini Name is not Nevai"
}

if (!($IniLines -contains "Profile=nevai")) {
  Fail "application.ini Profile is not nevai"
}

if ($IniLines -contains "[AppUpdate]") {
  Fail "application.ini contains active AppUpdate section"
}

$ZenUpdateHostHits = Get-ChildItem -LiteralPath $DistBin -Recurse -File -ErrorAction SilentlyContinue |
  Select-String -Pattern "updates\.zen-browser\.app" -ErrorAction SilentlyContinue
if ($ZenUpdateHostHits) {
  $ZenUpdateHostHits | Select-Object -First 20 | ForEach-Object { Write-Host $_ }
  Fail "Found Zen update host in Windows dist/bin"
}

Write-Host ""
Write-Host "== executable identity =="
$ExpectedExe = Join-Path $DistBin "nevai.exe"
if (Test-Path -LiteralPath $ExpectedExe -PathType Leaf) {
  Write-Host "OK executable: $ExpectedExe"
} else {
  Write-Host "Available executable candidates:"
  Get-ChildItem -LiteralPath $DistBin -File -Filter "*.exe" | Sort-Object Name | ForEach-Object { Write-Host $_.FullName }
  Fail "Expected executable is missing: $ExpectedExe"
}

Write-Host ""
Write-Host "== actor files =="
$Actors = Join-Path $DistBin "browser\actors"
if (!(Test-Path -LiteralPath $Actors -PathType Container)) {
  Fail "Missing browser actors directory: $Actors"
}

$RequiredActors = @(
  "ZenBoostsChild.sys.mjs",
  "ZenBoostsParent.sys.mjs",
  "ZenGlanceChild.sys.mjs",
  "ZenGlanceParent.sys.mjs"
)

foreach ($Actor in $RequiredActors) {
  $ActorPath = Join-Path $Actors $Actor
  if (!(Test-Path -LiteralPath $ActorPath -PathType Leaf)) {
    Fail "Missing actor: $ActorPath"
  }
  Write-Host "OK actor: $ActorPath"
}

Write-Host ""
Write-Host "== optional runtime launch =="
if ($env:NEVAI_WINDOWS_QA_LAUNCH -eq "1") {
  $Log = if ($env:NEVAI_WINDOWS_QA_LOG) { $env:NEVAI_WINDOWS_QA_LOG } else { Join-Path $env:TEMP "nevai-windows-alpha-start.log" }
  $ErrorLog = "$Log.err"
  if (Test-Path -LiteralPath $Log) {
    Remove-Item -LiteralPath $Log -Force
  }
  if (Test-Path -LiteralPath $ErrorLog) {
    Remove-Item -LiteralPath $ErrorLog -Force
  }

  $Process = Start-Process -FilePath $ExpectedExe -ArgumentList "--headless" -PassThru -RedirectStandardOutput $Log -RedirectStandardError $ErrorLog
  if (!$Process.WaitForExit(45000)) {
    Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
  }

  if (Test-Path -LiteralPath $ErrorLog) {
    Add-Content -LiteralPath $Log -Value (Get-Content -LiteralPath $ErrorLog -Raw)
  }

  $RuntimeHits = Select-String -LiteralPath $Log -Pattern "Failed to load resource:///actors|ZenBoostsChild|ZenGlanceChild|updates\.zen-browser\.app|AppUpdater" -ErrorAction SilentlyContinue
  if ($RuntimeHits) {
    $RuntimeHits | ForEach-Object { Write-Host $_ }
    Fail "Runtime blocker found in $Log"
  }

  Write-Host "Runtime blocker grep clean: $Log"
} else {
  Write-Host "Skipped. Set NEVAI_WINDOWS_QA_LAUNCH=1 to attempt a headless launch."
}

Write-Host ""
Write-Host "Windows alpha QA static checks passed."
