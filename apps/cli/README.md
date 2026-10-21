# eft

84000's command line, `eft`. Its commands:

- `eft search grep`, `phrase` and `quotes`: search Tibetan eTexts, in Unicode
  or EWTS.
- `eft extract`: one witness's text from an eText collection.

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
`kangyur-tengyur-recensions` skill as `scripts/eft.mjs` (see `bundles` in
`libs/lib-agent/plugins.json`).
