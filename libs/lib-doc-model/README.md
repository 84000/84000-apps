# @eightyfourthousand/lib-doc-model

Transformation between `passages` rows and TipTap editor content, in both
directions, plus the passage labels both sides renumber.

It has no runtime of its own yet — this package is currently the new home for
code that already existed in `lib-editing`. The per-passage Yjs document model
it is named for lands on top of it
([DEV-564](https://linear.app/84000/issue/DEV-564)).

## Why the code moved here

| Direction            | Modules                         |
| -------------------- | ------------------------------- |
| Row → editor content | `block.ts`, `transformers/`     |
| Editor content → row | `exporters/`, `passageFromNode` |
| Shared               | `labels.ts`, `mark-types.ts`    |

All of it lived in `lib-editing`, which is a React component library. That was
fine while the browser editor was the only caller. It is not fine now: the
per-passage document model and the server-side passage write service
([DEV-713](https://linear.app/84000/issue/DEV-713)) apply the same
transformation from a Next.js route handler, and re-seeding a passage document
from its row is exactly `blockFromPassage`.

It was already leaking. `apps/api-graphql`'s passage field resolver imports
`blockFromPassage` from `@eightyfourthousand/lib-editing`'s main barrel — a
server-side GraphQL resolver reaching into a React package for a pure function.

The two directions moved together because they are inverses: `round-trip.spec.ts`
asserts that every annotation which renders survives export with equivalent
coverage, and splitting the pair across packages would have put that contract on
a package boundary.

## Constraints

Nothing here may touch a browser API or import an editor. TypeScript cannot
enforce the first half — `data-access` is compiled from source and transitively
needs the DOM lib, so `dom` has to stay in `tsconfig.lib.json` and every browser
global is in scope as far as the compiler is concerned. `eslint.config.mjs`
restricts the globals instead.

## Surface

`transformers/` is not exported, matching what `lib-editing` did with it. Public
are `blockFromPassage`, `blocksFromTranslationBody`, `passageFromNode`, the
exporters, `incrementLabel` / `decrementLabel`, and `MARK_TYPES`.

`lib-editing` re-exports `blockFromPassage` and `blocksFromTranslationBody`, so
its consumers — `api-graphql`, `web-editor`, and the DEV-706 stack prototype —
are unchanged.

`ensureUuids` and `passagesFromNodes` stayed in `lib-editing`: both take a live
TipTap `Editor`, so neither can move.
