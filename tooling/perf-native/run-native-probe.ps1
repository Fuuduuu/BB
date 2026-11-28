$ErrorActionPreference = 'Stop'
$argv = @($args | Where-Object { $_ -ne '--' })
if ($argv.Count -ne 2 -or $argv[0] -cne '--out' -or !$argv[1]) {
  throw 'Usage: pnpm perf:native -- --out <directory>'
}
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$location = if ([IO.Path]::IsPathRooted($argv[1])) { $argv[1] } else { Join-Path $root $argv[1] }
$out = [IO.Path]::GetFullPath($location)
foreach ($file in @('native-acceptance-summary.json', 'acceptance-1-perf.json', 'acceptance-2-perf.json', 'acceptance-3-perf.json')) {
  if (Test-Path -LiteralPath (Join-Path $out $file)) {
    throw "Performance evidence already exists at $out. Use another output directory."
  }
}

$utf8 = [Text.UTF8Encoding]::new($false)
function Write-Json($path, $value) {
  [IO.File]::WriteAllText($path, ($value | ConvertTo-Json -Depth 30) + [Environment]::NewLine, $utf8)
}

function Get-Sha256($path) {
  $hash = [Security.Cryptography.SHA256]::Create()
  $stream = [IO.File]::OpenRead($path)
  try {
    return [BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()
  } finally {
    $stream.Dispose()
    $hash.Dispose()
  }
}

function Stop-OwnedProcess($process) {
  if ($process -and !$process.HasExited) {
    Stop-Process -Id $process.Id
    $process.WaitForExit()
  }
}

function Test-Drag($drag) {
  return $drag.committed -and $drag.revDelta -eq 1 -and $drag.previewFrames -ge 110
}

function Test-Run($result) {
  return $result.valid -and $result.hasFocus -and $result.visibilityState -eq 'visible' -and
    $result.window.width -eq 1280 -and $result.window.height -eq 800 -and
    (Test-Drag $result.drag) -and (Test-Drag $result.schematic.drag) -and
    $result.schematic.drag.command -eq 'items.translate' -and $result.schematic.drag.view -eq 'schematic'
}

function Read-ProbeLine($app, $path, $previous) {
  for ($poll = 0; $poll -lt 420; $poll++) {
    if (Test-Path -LiteralPath $path) {
      $lines = @(Get-Content -LiteralPath $path -Encoding UTF8)
      # Rotation can replace the active file during a run.
      $skip = if ($lines.Count -ge $previous) { $previous } else { 0 }
      $received = $lines | Select-Object -Skip $skip |
        Where-Object { $_ -match '\[perf\] \{' } | Select-Object -Last 1
      if ($received) { return $received }
    }
    if ($app.HasExited) { throw "Probe exited with code $($app.ExitCode)" }
    Start-Sleep -Milliseconds 500
  }
  throw 'No complete performance result arrived within 210 seconds.'
}

$commit = & git.exe -C $root rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'Cannot read the source commit.' }
$changes = @(& git.exe -C $root status --porcelain)
if ($LASTEXITCODE -ne 0) { throw 'Cannot read the worktree status.' }
[IO.Directory]::CreateDirectory($out) | Out-Null

$manifest = Join-Path $root 'apps/desktop/src-tauri/Cargo.toml'
$metadata = & cargo.exe metadata --manifest-path $manifest --locked --offline --no-deps --format-version=1 |
  ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Cannot read Cargo metadata.' }
$version = ($metadata.packages | Where-Object name -eq 'pcbk-desktop').version
if (!$version) { throw 'The pcbk-desktop version is missing.' }

$configText = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-perf.tauri.json') -Raw
$config = $configText | ConvertFrom-Json
$log = Join-Path $env:LOCALAPPDATA "$($config.identifier)/logs/pcbk.log"
$exe = Join-Path $out 'pcbk-native-probe.exe'
$oldTauriConfig = $env:TAURI_CONFIG
$oldPreference = $ErrorActionPreference
try {
  $env:TAURI_CONFIG = $configText
  # Cargo reports build progress on stderr; the exit code determines success.
  $ErrorActionPreference = 'Continue'
  & cargo.exe build --manifest-path $manifest --locked --offline --features desktop --bin pcbk-desktop 2>&1 |
    ForEach-Object { $_.ToString() } |
    Tee-Object -FilePath (Join-Path $out 'native-build.log')
  if ($LASTEXITCODE -ne 0) { throw "Native probe build failed with code $LASTEXITCODE." }
} finally {
  $env:TAURI_CONFIG = $oldTauriConfig
  $ErrorActionPreference = $oldPreference
}

Copy-Item -LiteralPath (Join-Path $metadata.target_directory 'debug/pcbk-desktop.exe') -Destination $exe
Write-Json (Join-Path $out 'native-build.json') ([ordered]@{
  commit = $commit
  clean = $changes.Count -eq 0
  version = $version
  exeSha256 = Get-Sha256 $exe
  identifier = $config.identifier
})

$server = $null
$oldOut = $env:PCBK_NATIVE_PROBE_OUT
$ready = Join-Path $out ('server-ready-' + [Guid]::NewGuid().ToString('N'))
$oldReady = $env:PCBK_NATIVE_PROBE_READY
try {
  $env:PCBK_NATIVE_PROBE_OUT = $out
  $env:PCBK_NATIVE_PROBE_READY = $ready
  $server = Start-Process -FilePath node.exe -ArgumentList 'tooling/perf-native/serve-native-probe.mjs' -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $out 'native-server.log') -RedirectStandardError (Join-Path $out 'native-server-errors.log')
  for ($poll = 0; $poll -lt 80 -and !(Test-Path -LiteralPath $ready); $poll++) {
    if ($server.HasExited) { throw "Native probe server exited with code $($server.ExitCode)." }
    Start-Sleep -Milliseconds 250
  }
  if (!(Test-Path -LiteralPath $ready)) { throw 'Native probe server did not listen on port 1420.' }

  foreach ($run in 1..3) {
    $accepted = Join-Path $out "acceptance-$run-perf.json"
    $valid = $false
    for ($attempt = 1; $attempt -le 3; $attempt++) {
      $previous = if (Test-Path -LiteralPath $log) { @(Get-Content -LiteralPath $log -Encoding UTF8).Count } else { 0 }
      $app = $null
      try {
        $app = Start-Process -FilePath $exe -WorkingDirectory $out -WindowStyle Hidden -PassThru
        Write-Output "RUN $run attempt $attempt PID $($app.Id)"
        $line = Read-ProbeLine $app $log $previous
        $json = $line.Substring($line.IndexOf('[perf] {') + 7)
        $result = $json | ConvertFrom-Json
        $valid = Test-Run $result
      } catch {
        $result = @{ valid = $false; invalidReasons = @('runner_error'); error = $_.Exception.Message }
        $json = $result | ConvertTo-Json
      } finally {
        Stop-OwnedProcess $app
      }
      if ($valid) {
        [IO.File]::WriteAllText($accepted, $json, $utf8)
        Write-Output ("VALID board pan/zoom/drag {0:F2}/{1:F2}/{2:F2}; schematic {3:F2}/{4:F2}/{5:F2}" -f $result.pan.fps,$result.zoom.fps,$result.drag.fps,$result.schematic.pan.fps,$result.schematic.zoom.fps,$result.schematic.drag.fps)
        break
      }
      $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
      $rejected = Join-Path $out "rejected-$run-$attempt-$stamp.json"
      [IO.File]::WriteAllText($rejected, $json, $utf8)
      Write-Output "REJECTED: $($result.invalidReasons -join ',') $($result.error) $($result.mismatched -join ',')"
      Start-Sleep -Seconds 2
    }
    if (!$valid) { throw "No valid result after three attempts for run $run. See the rejected JSON in $out." }
    Start-Sleep -Seconds 2
  }
  & node.exe (Join-Path $PSScriptRoot 'summarize-native.mjs') $out
  if ($LASTEXITCODE -ne 0) { throw "Native summary failed with code $LASTEXITCODE." }
} finally {
  Stop-OwnedProcess $server
  [IO.File]::Delete($ready)
  $env:PCBK_NATIVE_PROBE_OUT = $oldOut
  $env:PCBK_NATIVE_PROBE_READY = $oldReady
}
