# eft

84000's command line, `eft`. Its commands:

- `eft search grep`, `phrase` and `quotes`: search Tibetan eTexts, in Unicode
  or EWTS.
- `eft extract`: one witness's text from an eText collection.
- `eft structure`: a text's closing and speech formulas, with folios.

Run `eft --help` for the commands, and `eft <command> --help` for one
command's arguments and options.

The syllable analysis the Tibetan commands match on is
`@eightyfourthousand/lib-tibetan`; `src/tibetan/` adds reading eText
collections and plain `[F.12.a]` files and the n-gram search. Each command is
a file under `src/commands/` (a group such as `search` is a folder), listed in
its group's `commands`. The app uses only `node:fs` and `node:path`, so it runs
unchanged on Node and Bun.

```sh
npx nx bundle cli    # dist/apps/cli/eft.mjs, for node
npx nx compile cli   # standalone binaries, dist/apps/cli/bin/eft-<platform> (needs bun)
node apps/cli/build.mjs compile --targets darwin-arm64
```

Until the binaries are released, the plugin build bundles it into the
`kangyur-tengyur-recensions` and `text-analysis-and-retrieval` skills as
`scripts/eft.mjs` (see `bundles` in `libs/lib-agent/plugins.json`),
so a change here is a plugin change and needs a lib-agent version bump.

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
  `end` row.
- `numerals`: the words of a cardinal number and their values. `units` are
  1–9; a unit before a word in `tens`, `hundreds` or `thousands` multiplies
  it (`bzhi bcu` 40), after it adds (`bcu bzhi` 14); `joiners` (`rtsa`,
  `dang`) carry no value; `first` is `dang` of `dang po`.
- `speech`: speech formulas.

An edited copy can be passed with `--patterns`; `--print-patterns` writes out
the built-in one. The file is JSON so that both runtimes read it with no
parser, and the compiled binary carries it.
