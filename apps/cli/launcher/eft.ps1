# Runs eft, 84000's command line, with the arguments given. The PowerShell
# twin of eft.sh, for Windows without a POSIX shell:
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File <skill>/scripts/eft.ps1 <args>
#
# Uses the standalone binary that eft-release.txt (beside this script) pins:
# downloaded once into the 84000 cache, cache/bin/eft/<version>/, and checked
# against its pinned SHA-256 before every run. A binary that does not match is
# never run. Where no binary fits this machine, or it cannot be had, runs the
# bundled eft.mjs with node instead, and says so.
#
# The 84000 root is .\84000 unless EFT_84000_ROOT names another.
# Messages go to stderr; stdout is eft's own.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$eftArgs = $args

function Say([string]$message) {
  [Console]::Error.WriteLine("eft: $message")
}

# Run the bundled script with node; $why says why.
function Fallback([string]$why) {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($node) {
    Say "$why; running the bundled eft.mjs with node instead."
    & $node.Source (Join-Path $PSScriptRoot 'eft.mjs') @eftArgs
    exit $LASTEXITCODE
  }
  Say "$why, and node is not installed to run the bundled eft.mjs instead."
  exit 1
}

function Get-Sha256([string]$path) {
  (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant()
}

$pinsPath = Join-Path $PSScriptRoot 'eft-release.txt'
$pins = @{}
if (Test-Path -LiteralPath $pinsPath) {
  foreach ($line in Get-Content -LiteralPath $pinsPath) {
    if ($line -match '^([^#=]+)=(.*)$') { $pins[$Matches[1]] = $Matches[2] }
  }
}
$version = $pins['version']
$url = $pins['url']
if (-not $version -or -not $url) {
  Say "$pinsPath is missing or names no release."
  exit 1
}

# Windows PowerShell 5.1 predates $IsWindows, and runs only on Windows.
$os = if ($null -eq $IsWindows -or $IsWindows) { 'windows' }
  elseif ($IsMacOS) { 'darwin' }
  elseif ($IsLinux) { 'linux' }
$arch = switch ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()) {
  'X64' { 'x64' }
  # Windows on Arm runs the x64 binary under emulation.
  'Arm64' { if ($os -eq 'windows') { 'x64' } else { 'arm64' } }
}
if (-not $os -or -not $arch) { Fallback "no eft binary for this machine" }
$platform = "$os-$arch"
$expected = $pins[$platform]
if (-not $expected) { Fallback "no eft binary for $platform" }

$exe = "eft-$platform"
if ($os -eq 'windows') { $exe = "$exe.exe" }
$root = if ($env:EFT_84000_ROOT) { $env:EFT_84000_ROOT } else { '84000' }
$dir = Join-Path $root (Join-Path 'cache' (Join-Path 'bin' (Join-Path 'eft' $version)))
$bin = Join-Path $dir $exe

if (Test-Path -LiteralPath $bin) {
  if ((Get-Sha256 $bin) -eq $expected) {
    & $bin @eftArgs
    exit $LASTEXITCODE
  }
  Say "$bin does not match the checksum this skill pins; removing it and downloading it again."
  Remove-Item -LiteralPath $bin -Force
}

New-Item -ItemType Directory -Force -Path $dir | Out-Null
$part = Join-Path $dir ".$exe.$PID.part"
Say "downloading eft $version for $platform (about 90 MB) into $dir; later runs reuse it."
try {
  # Windows PowerShell 5.1 may default to a TLS version GitHub refuses.
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri "$url/$exe" -OutFile $part -UseBasicParsing
} catch {
  Remove-Item -LiteralPath $part -Force -ErrorAction SilentlyContinue
  Fallback "could not download $url/$exe"
}
$got = Get-Sha256 $part
if ($got -ne $expected) {
  Remove-Item -LiteralPath $part -Force
  Say "refusing to run the downloaded ${exe}: its SHA-256 is $got, but this skill pins $expected. Nothing was run, and the download was deleted."
  exit 1
}
if ($os -ne 'windows') { & chmod +x $part }
Move-Item -LiteralPath $part -Destination $bin -Force
& $bin @eftArgs
exit $LASTEXITCODE
