# tibetan-search

A command-line search over Tibetan eTexts, in Unicode or EWTS: `quotes` and
`extract`. Run `--help` for the modes and options.

The syllable analysis it matches on is `@eightyfourthousand/lib-tibetan`;
this app adds reading eText collections and plain `[F.12.a]` files, the
n-gram search and the command line. It uses only `node:fs` and `node:path`,
so it runs unchanged on Node and Bun.

```sh
npx nx bundle tibetan-search    # dist/apps/tibetan-search/tibetan-search.mjs, for node
npx nx compile tibetan-search   # standalone binaries, one per platform (needs bun)
node apps/tibetan-search/build.mjs compile --targets darwin-arm64
```
