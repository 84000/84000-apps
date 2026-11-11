# eft

84000's command line, `eft`. Its commands:

- `eft search grep`, `phrase` and `quotes`: search Tibetan eTexts, in Unicode
  or EWTS.
- `eft extract`: one witness's text from an eText collection.
- `eft structure`: a text's closing and speech formulas, with folios.
- `eft docx check-tracked`: check a tracked-changes copy of a Word file
  against its original: rejecting the revisions gives the original, structure
  and formatting included; accepting them keeps every line break, tab and note
  reference; and each tracked change covers only the text that changes.

Run `eft --help` for the commands, and `eft <command> --help` for one
command's arguments and options.

The syllable analysis the Tibetan commands match on is
`@eightyfourthousand/lib-tibetan`; `src/tibetan/` adds reading eText
collections and plain `[F.12.a]` files and the n-gram search; `src/docx/`
reads Word files with its own zip reader and XML parser. Each command is a
file under `src/commands/` (a group such as `search` is a folder), listed in
its group's `commands`. The app uses only `node:fs`, `node:path` and
`node:zlib`, so it runs unchanged on Node and Bun.

```sh
npx nx bundle cli    # dist/apps/cli/eft.mjs, for node
npx nx compile cli   # standalone binaries, dist/apps/cli/bin/eft-<platform> (needs bun)
node apps/cli/build.mjs compile --targets darwin-arm64
```

Skills run eft through the launchers in `launcher/`: `eft.sh` (POSIX sh, also
Git Bash on Windows) and `eft.ps1` (PowerShell). The plugin build ships them
into each skill `eft` names in `libs/lib-agent/plugins.json`, with
`eft-release.txt`, which pins this version's release and each binary's
SHA-256, read from the release's `SHA256SUMS`, and `eft.mjs`, the node bundle.
A launcher downloads the binary for its machine into the 84000 cache
(`84000/cache/bin/eft/<version>/`), checks it against the pin before every
run and refuses one that does not match. Where no binary fits, or the download
fails, it runs `eft.mjs` with node and says so. A change here is a plugin
change and needs a lib-agent version bump.

## Releases

The version is in `package.json` (`eft --version` prints it). Bumping it on
`main` runs `.github/workflows/release-eft.yml`, which compiles the binaries
with a pinned bun for darwin-arm64, darwin-x64, linux-x64, linux-arm64 and
windows-x64 and publishes them, with a `SHA256SUMS`, as the GitHub release
`eft-v<version>`. Pull requests that touch the CLI build and smoke-test the
binaries without publishing; the binaries are attached to the run.

A release is never replaced: skills pin its checksums, so a rebuilt binary
under the same version would be refused. Bump the version for any change that
should reach users. The plugin build pins the release this file names and fails
when it does not exist, so release eft before, or in the same push as, the
lib-agent bump that ships it: `publish-plugins.yml` waits for the release.

## Structure patterns

`structure` finds closing formulas and speech formulas with the patterns in
`structure-patterns.json`, which is compiled into the CLI. Every entry is
EWTS or Unicode, matched syllable by syllable (`+` ignored, `'` or `’` for the
a-chung). Add a label or spelling there, not in code:

- `divisions.labels`: division labels (`le'u`, `brtag pa`, …). A closing
  formula is a label, optionally its own count (`le'u gnyis pa`), a tail
  (`labelTails`: `zhes bya ba`) and a connective (`connectives`: `ste`), then
  an ordinal or a terminator, then the closing shad.
- `divisions.ordinalEndings` close an ordinal (`pa'o`, `po'o`);
  `ordinalStems` are the same before a terminator or a bare shad (`pa`).
- `divisions.terminators`: `rdzogs so`. Without a label before it, it is an
  `end` row, found only where a statement ends and not after `ma` or `mi`.
- `numerals`: the words of a cardinal number and their values. `units` are
  1–9; a unit before a word in `tens`, `hundreds` or `thousands` multiplies
  it (`bzhi bcu` 40), after it adds (`bcu bzhi` 14); `joiners` (`rtsa`,
  `dang`) carry no value; `first` is `dang` of `dang po`.
- `speech`: speech formulas, found only before a shad.

An edited copy can be passed with `--patterns`; `--print-patterns` writes out
the built-in one. The file is JSON so that both runtimes read it with no
parser, and the compiled binary carries it.
