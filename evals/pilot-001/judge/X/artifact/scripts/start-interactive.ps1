$ErrorActionPreference = 'Stop'
$prototypeRoot = Split-Path -Parent $PSScriptRoot
$serverPath = Join-Path $prototypeRoot 'src\server.mjs'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  Write-Error '[Moonwake] Node.js was not found on PATH.'
  exit 2
}

Write-Host ('[Moonwake] Node ' + (& $nodeCommand.Source --version))
$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = $nodeCommand.Source
$startInfo.Arguments = '"' + $serverPath + '"'
$startInfo.WorkingDirectory = $prototypeRoot
$startInfo.UseShellExecute = $false
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
$process = New-Object System.Diagnostics.Process
$process.StartInfo = $startInfo

try {
  if (-not $process.Start()) { throw 'The local Node service did not start.' }
  $readyTask = $process.StandardOutput.ReadLineAsync()
  if (-not $readyTask.Wait(10000)) { throw 'The local service did not become ready within 10 seconds.' }
  $readyLine = $readyTask.Result
  if ($readyLine -notmatch '^READY (http://127\.0\.0\.1:\d+)$') {
    $errorLine = $process.StandardError.ReadToEnd()
    throw ('Unexpected startup response: ' + $readyLine + ' ' + $errorLine)
  }
  $url = $Matches[1]
  Write-Host ('[Moonwake] Ready at ' + $url)
  Write-Host '[Moonwake] Opening the default browser. Press Ctrl+C here to stop only this local service.'
  try {
    Start-Process -FilePath $url -ErrorAction Stop | Out-Null
  } catch {
    Write-Host ('[Moonwake] Browser open failed. Safe local URL: ' + $url)
    throw
  }
  $process.WaitForExit()
  exit $process.ExitCode
} finally {
  if ($process -and -not $process.HasExited) {
    $process.Kill()
    $process.WaitForExit()
  }
}
