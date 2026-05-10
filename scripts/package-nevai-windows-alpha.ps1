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

& (Join-Path $Root "scripts\qa-nevai-windows-alpha.ps1") -DistBin $DistBin

$Out = Join-Path (Split-Path $Root -Parent) "builds-local\windows"
$Archive = Join-Path $Out "Nevai-windows-alpha-dev.zip"
$Sha = Join-Path $Out "Nevai-windows-alpha-dev.SHA256.txt"
$Readme = Join-Path $Out "README-alpha.txt"

New-Item -ItemType Directory -Path $Out -Force | Out-Null
Remove-Item -LiteralPath $Archive, $Sha -Force -ErrorAction SilentlyContinue

Write-Host "== Packaging Nevai Windows unsigned alpha =="
Write-Host "Input: $DistBin"

$Parent = Split-Path $DistBin -Parent
$Leaf = Split-Path $DistBin -Leaf
Compress-Archive -Path (Join-Path $Parent $Leaf) -DestinationPath $Archive -Force

$Hash = (Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLowerInvariant()
"$Hash  $Archive" | Set-Content -LiteralPath $Sha -Encoding ASCII

@"
Nevai Browser Windows local unsigned alpha

Status:
- Local development alpha build
- Unsigned
- Not for public production distribution

Artifact:
- Nevai-windows-alpha-dev.zip

SHA-256:
$Hash

Known limitations:
- Automatic updater is disabled for alpha.
- This artifact is intended for local/manual testing only.
- Windows installer/signing/default-browser registration are out of scope for Stage 2.
"@ | Set-Content -LiteralPath $Readme -Encoding ASCII

Write-Host ""
Write-Host "Output:"
Get-ChildItem -LiteralPath $Out | Sort-Object Name | Format-Table -AutoSize

