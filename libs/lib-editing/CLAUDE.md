# lib-editing

TipTap-based editor and reader components for translation content.

## Transformation Pipeline

Passages ↔ TipTap editor nodes is a bidirectional transformation:

**Both directions now live in `@eightyfourthousand/lib-doc-model`** — `block.ts`
plus `transformers/` one way, `exporters/` plus `passageFromNode()` the other,
along with the `incrementLabel` / `decrementLabel` label helpers. They moved
because the per-passage document model and the server-side write path apply the
same transformation from a Next.js route handler, and this package is a React
component library.

- **Passages → Editor**: `blocksFromTranslationBody()` / `blockFromPassage()`, re-exported from this package's barrel for existing consumers.
- **Editor → Passages**: `passage.ts` is what remains here — `passagesFromNodes()` and `ensureUuids()`, both of which take a live TipTap `Editor` and so cannot move.

## TipTap Extensions

42 custom extensions in `components/editor/Extensions/`. Key ones: `Passage` (block-level node with uuid, label, sort, type), `GlossaryInstance` (mark linking to glossary), `InternalLink`, `EndNoteLink`, `Heading`, `Paragraph`, `LeadingSpace`, `Indent`, `SlashCommand`.

## Key Components

- `EditorProvider` — manages editor state, dirty tracking, Yjs sync, and save lifecycle
- `TranslationBuilder` — orchestrates building translations from passages
- `PaginationProvider` — manages pagination through content
