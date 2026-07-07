# Chrome 웹스토어 제출용 ZIP 생성 (manifest.json이 ZIP 루트에 오도록)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $root
$outDir = Join-Path $repoRoot 'dist'
$zipPath = Join-Path $outDir 'pricehunter-extension.zip'
$staging = Join-Path $env:TEMP ('ph-ext-store-' + [guid]::NewGuid().ToString())

New-Item -ItemType Directory -Path $outDir -Force | Out-Null
New-Item -ItemType Directory -Path $staging -Force | Out-Null

$exclude = @(
  'package-for-store.ps1',
  'CHROME_WEB_STORE.md',
  'README.md',
  'scripts'
)

Get-ChildItem -Path $root -Force | Where-Object {
  $exclude -notcontains $_.Name
} | ForEach-Object {
  Copy-Item -Path $_.FullName -Destination (Join-Path $staging $_.Name) -Recurse -Force
}

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zipPath -Force
Remove-Item $staging -Recurse -Force

Write-Host "Created: $zipPath"
Write-Host "Upload this ZIP at https://chrome.google.com/webstore/devconsole"
