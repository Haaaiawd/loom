$ErrorActionPreference = 'Stop'
$prototypeRoot = Split-Path -Parent $PSScriptRoot
$evidenceDirectory = Join-Path $prototypeRoot 'evidence'
$evidenceFile = Join-Path $evidenceDirectory 'smoke-launch.txt'
$runner = Join-Path $prototypeRoot 'test\e2e\smoke-runner.mjs'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw 'Node.js was not found on PATH.' }
New-Item -ItemType Directory -Force -Path $evidenceDirectory | Out-Null
$lines = & $nodeCommand.Source $runner 2>&1
if ($LASTEXITCODE -ne 0) { throw ('Smoke runner failed: ' + ($lines -join [Environment]::NewLine)) }
$text = $lines -join [Environment]::NewLine
if ($text -notmatch 'NODE_VERSION v\d+') { throw 'Smoke output did not record the Node version.' }
if ($text -notmatch 'READY http://127\.0\.0\.1:\d+') { throw 'Smoke output did not record an assigned loopback URL.' }
if ($text -notmatch 'STATE_ROUND_TRIP true') { throw 'Smoke state round trip failed.' }
if ($text -notmatch 'GRACEFUL_SHUTDOWN true') { throw 'Smoke graceful shutdown was not recorded.' }
[System.IO.File]::WriteAllText($evidenceFile, $text + [Environment]::NewLine)
Write-Output $text
Write-Output ('SMOKE_OK evidence=' + $evidenceFile)
