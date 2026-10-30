# lib-editing

TipTap-based editor and reader components for translation content.

## Transformation Pipeline

Passages ↔ TipTap editor nodes is a bidirectional transformation:

- **Passages → Editor**: `block.ts` converts `Passage[]` to TipTap content via `blocksFromTranslationBody()`. Annotation transformers in `transformers/` apply inline markup as TipTap marks and node attributes.
- **Editor → Passages**: `passage.ts` extracts passages via `passagesFromNodes()`. Exporters in `exporters/` reverse the annotation transformation. `ensureUuids()` synchronizes UUIDs before saving.

## TipTap Extensions

42 custom extensions in `components/editor/Extensions/`. Key ones: `Passage` (block-level node with uuid, label, sort, type), `GlossaryInstance` (mark linking to glossary), `InternalLink`, `EndNoteLink`, `Heading`, `Paragraph`, `LeadingSpace`, `Indent`, `SlashCommand`.

## Key Components

- `EditorProvider` — the editor's permissions, read-only state, dirty flag, and save lifecycle; the stack registers what a save writes
- `StackWorkProvider` / `PassageStack` (`components/stack/`) — the editor: one TipTap editor per passage, see its README
- `PaginationProvider` — manages pagination through content for the reader
