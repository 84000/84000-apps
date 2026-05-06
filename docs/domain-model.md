# Domain Model

## About 84000

84000: Translating the Words of the Buddha is a global nonprofit translating the Tibetan Buddhist canon (the Kangyur and Tengyur) into modern languages. The web platform hosts published translations for public reading and provides internal tools for translation management, editing, and review.

## Core Entities

### Work

A translatable text from the canon. Each work has a UUID and one or more **Tohoku catalog numbers** (e.g., `toh1`, `toh287`) — the standard reference system for texts in the Tibetan canon. Works also carry titles in multiple languages, a publication version (semver), and section metadata.

- Types: `Work`, `WorkDTO` in `libs/data-access/src/lib/types/work.ts`
- A work may have multiple Tohs (composite texts spanning catalog entries)

### Passage

The fundamental content unit. A passage is a block of translated text within a work, carrying:

- `uuid` and `workUuid` — identity
- `content` — the text itself
- `type` — a `BodyItemType` classifying its role in the translation
- `sort` — ordering within its section
- `label` — display label (e.g., paragraph number)
- `annotations` — inline markup (see Annotations below)
- `alignments` — links to Tibetan source text (see Alignments)

**Body item types** define the structure of a translation. They are grouped into:

| Group | Types |
|-------|-------|
| Front matter | acknowledgment, summary, introduction |
| Body | prelude, prologue, translation, appendix, colophon, homage |
| Back matter | abbreviations, endnotes |

Each type also has a corresponding `*Header` variant. See `BODY_ITEM_TYPES` in `libs/data-access/src/lib/types/passage.ts`.

- Types: `Passage`, `PassageDTO`, `PassageRowDTO`, `PassagesPage` in `libs/data-access/src/lib/types/passage.ts`

### Annotation

Inline markup applied to passage content. Annotations use character offsets (`start`, `end`) to mark spans of text. The system supports 30+ annotation types covering:

- **Structure**: paragraph, heading, line, lineGroup, list, listItem, table, blockquote, indent, leadingSpace
- **Semantics**: glossaryInstance (links text to a glossary term), endNoteLink, internalLink, mention, abbreviation, hasAbbreviation
- **Formatting**: span (with text-style, language), mantra, quote, code
- **Media**: image, audio, link

Every annotation has a `uuid`, `start`/`end` offsets, and a `type`. Type-specific fields carry additional data (e.g., `GlossaryInstanceAnnotation` has `authority` and `glossary` fields).

- Types: `libs/data-access/src/lib/types/annotation/` (34 files covering all annotation types and transformers)
- DTO ↔ domain mapping handles the conversion between `kebab-case` database types and `camelCase` application types

### Alignment

Links a passage to its Tibetan source text via folio references. An alignment connects a passage UUID to a folio UUID, with the Tibetan text content and folio/volume location.

- Types: `Alignment`, `AlignmentDTO` in `libs/data-access/src/lib/types/alignment.ts`

### Folio

A physical page from a Tibetan source text. Identified by volume number, folio number, and side (`a` or `b`). Contains the Tibetan source text content.

- Types: `Folio`, `FolioDTO` in `libs/data-access/src/lib/types/folio.ts`

### Title

Works have titles in multiple languages and types:

- **Types**: `toh`, `mainTitle`, `longTitle`, `otherTitle`, `shortcode`, `mainTitleOutsideCatalogueSection`
- **Languages**: Tibetan (`bo`), English (`en`), Wylie transliteration (`Bo-Ltn`), Sanskrit (`Sa-Ltn`), plus extended languages (Chinese, Japanese, Mongolian, Pali, Pinyin)

- Types: `Title`, `TitleDTO` in `libs/data-access/src/lib/types/title.ts`
- Language types: `libs/data-access/src/lib/types/language.ts`

### Glossary

Terms and their definitions, linked to authority records. The glossary system has two levels:

1. **Authority-level terms** — canonical definitions with names in multiple languages (English, Tibetan, Sanskrit, Pali, Chinese, Wylie)
2. **Work-level instances** (`GlossaryTermInstance`) — how a term is used in a specific translation, with term number and passage references

- Types: `Glossary`, `GlossaryTermInstance` in `libs/data-access/src/lib/types/glossary.ts`
- Glossary page types: `libs/data-access/src/lib/types/glossary-page.ts`

### Bibliography

Citations and references within a work. Organized as entries with headings, each containing items with HTML-formatted citation text.

- Types: `Bibliography`, `BibliographyEntry` in `libs/data-access/src/lib/types/bibliography.ts`

### Imprint

Per-Toh publication metadata: version, restriction status, publication year, Tibetan authors, translator credits, license information, and titles by language. A work with multiple Tohs has an imprint for each.

- Types: `Imprint`, `ImprintDTO` in `libs/data-access/src/lib/types/imprint.ts`
- Also defines `TocEntry` and `Toc` (table of contents) — hierarchical structure with front matter, body, and back matter sections

### Table of Contents

The `Toc` type organizes a work's structure into three sections (`frontMatter`, `body`, `backMatter`), each containing a tree of `TocEntry` nodes with `children` for nesting.

## User System

### Roles (hierarchical)

`reader` < `scholar` < `translator` < `editor` < `admin`

### Permissions

- `projects.read`, `projects.edit`, `projects.admin`
- `editor.read`, `editor.edit`, `editor.admin`

Authorization is enforced via Supabase RPC (`authorize` function) and GraphQL context helpers (`requireAuth`, `requireRole`).

- Types: `UserRole`, `UserPermission` in `libs/data-access/src/lib/types/user.ts`
- Auth functions: `libs/data-access/src/lib/auth.ts`

## The DTO Pattern

Every entity follows a consistent transformation pattern:

1. **DTO** (`*DTO`) — matches the database column naming (snake_case)
2. **Domain type** — camelCase, used throughout the application
3. **Mapper functions** (`*FromDTO`, `*ToDTO`) — convert between the two

This pattern is consistent across all entities. When adding a new entity or field, follow the existing pattern in `libs/data-access/src/lib/types/`.

## Entity Relationships

```
Work (uuid, toh[])
├── Passages[] (content blocks, ordered by sort)
│   ├── Annotations[] (inline markup, character offsets)
│   └── Alignments[] (links to Tibetan source folios)
├── Folios[] (Tibetan source pages)
├── Titles[] (multi-language)
├── Imprint (per-toh publication metadata)
│   └── Toc (hierarchical table of contents)
├── GlossaryTermInstances[] (work-level glossary usage)
├── BibliographyEntries[] (citations)
└── Library items (user bookmarks/saves)
```
