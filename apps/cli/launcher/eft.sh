#!/bin/sh
# Runs eft, 84000's command line, with the arguments given.
#
# Uses the standalone binary that eft-release.txt (beside this script) pins:
# downloaded once into the 84000 cache, cache/bin/eft/<version>/, and checked
# against its pinned SHA-256 before every run. A binary that does not match is
# never run. Where no binary fits this machine, or it cannot be had, runs the
# bundled eft.mjs with node instead, and says so.
#
# The 84000 root is ./84000 unless EFT_84000_ROOT names another.
# Messages go to stderr; stdout is eft's own.

set -u

here=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd) || exit 1
pins="$here/eft-release.txt"

say() { printf 'eft: %s\n' "$*" >&2; }
pin() { sed -n "s/^$1=//p" "$pins" 2>/dev/null | head -n 1; }

# Run the bundled script with node; $1 says why.
fallback() {
  why=$1
  shift
  if command -v node >/dev/null 2>&1; then
    say "$why; running the bundled eft.mjs with node instead."
    exec node "$here/eft.mjs" "$@"
  fi
  say "$why, and node is not installed to run the bundled eft.mjs instead."
  exit 1
}

# This machine's release platform, or nothing when no binary fits.
platform() {
  os=$(uname -s)
  arch=$(uname -m)
  case $os in
    Darwin)
      os=darwin
      # A shell under Rosetta reports x86_64 on Apple silicon.
      [ "$(sysctl -n sysctl.proc_translated 2>/dev/null)" = 1 ] && arch=arm64
      ;;
    Linux)
      os=linux
      # The linux binaries are built against glibc.
      for f in /lib/ld-musl-*; do [ -e "$f" ] && return 1; done
      ;;
    MINGW* | MSYS* | CYGWIN*) os=windows ;;
    *) return 1 ;;
  esac
  case $arch in
    arm64 | aarch64) arch=arm64 ;;
    x86_64 | amd64) arch=x64 ;;
    *) return 1 ;;
  esac
  echo "$os-$arch"
}

hasher() {
  for h in sha256sum shasum openssl; do
    command -v "$h" >/dev/null 2>&1 && echo "$h" && return 0
  done
  return 1
}

sha256() {
  case $(hasher) in
    sha256sum) sha256sum "$1" ;;
    shasum) shasum -a 256 "$1" ;;
    openssl) openssl dgst -sha256 -r "$1" ;;
  esac | cut -d ' ' -f 1
}

fetch() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 2 -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$2" "$1"
  else
    return 1
  fi
}

version=$(pin version)
url=$(pin url)
if [ -z "$version" ] || [ -z "$url" ]; then
  say "$pins is missing or names no release."
  exit 1
fi

plat=$(platform) || fallback "no eft binary for $(uname -s) $(uname -m)" "$@"
expected=$(pin "$plat")
[ -n "$expected" ] || fallback "no eft binary for $plat" "$@"
hasher >/dev/null || fallback "no sha256sum, shasum or openssl to check the eft binary with" "$@"

exe="eft-$plat"
case $plat in windows-*) exe="$exe.exe" ;; esac
dir="${EFT_84000_ROOT:-84000}/cache/bin/eft/$version"
bin="$dir/$exe"

if [ -f "$bin" ]; then
  [ "$(sha256 "$bin")" = "$expected" ] && exec "$bin" "$@"
  say "$bin does not match the checksum this skill pins; removing it and downloading it again."
  rm -f -- "$bin"
fi

mkdir -p -- "$dir" || fallback "cannot create $dir" "$@"
part="$dir/.$exe.$$.part"
trap 'rm -f -- "$part"' EXIT
trap 'exit 1' HUP INT TERM
say "downloading eft $version for $plat (about 90 MB) into $dir; later runs reuse it."
if ! fetch "$url/$exe" "$part"; then
  rm -f -- "$part"
  fallback "could not download $url/$exe" "$@"
fi
got=$(sha256 "$part")
if [ "$got" != "$expected" ]; then
  say "refusing to run the downloaded $exe: its SHA-256 is $got, but this skill pins $expected. Nothing was run, and the download was deleted."
  exit 1
fi
chmod +x "$part" && mv -f -- "$part" "$bin" || exit 1
exec "$bin" "$@"
