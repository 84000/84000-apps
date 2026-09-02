# The passage stack

One TipTap editor per passage, mounted only where focus is, over the
per-passage document model in `@eightyfourthousand/lib-doc-model`.

`PassageStackController` is the view half and owns nothing about what the work
*is* — the spine, the passage documents, split/merge/delete and the command log
belong to `WorkDocument`. See its class comment for the two windows (hydration
is scroll-driven, the live editor set is focus-driven) and why they are separate.

## Extension audit

The production editor builds one document per panel from
`useTranslationExtensions`. The stack builds one per passage, which changes what
each extension can assume. Two lists, and the split between them is load
bearing:

- **`buildStackSchemaExtensions`** — nodes, marks and attributes. This is what
  `getSchema` feeds to `PassageDoc` for parsing and to `renderToHTMLString` for
  static rows, so it runs in contexts with no editor and no view. Only
  schema-contributing extensions belong here.
- **`buildStackEditorExtensions`** — the schema set plus commands, plugins and
  the Yjs binding. Mounted per live editor.

### Differences from the production set

| Extension | Where | Why |
|---|---|---|
| `TranslationDocument` → `StackDocument` | schema | A passage's children *are* the document. Its top node is `block+`. |
| `PassageNode` | absent | Passage identity (uuid, label, sort, type, toh) lives in the spine, not in a wrapping node. Its `splitPassage` / `normalizeLabelsAfter` commands become `WorkDocument.split` and spine renumbering. |
| `AnnotationToh` | schema | Not what carries a toh scope — `TranslationMetadata` already declares `toh` on every type. It renders `data-toh`, which is the attribute the reader's toh-visibility rule reads; without it a passage scoped to an inactive Tohoku text cannot be hidden in the static tier. |
| `SlashCommand` | editor | A plugin, so it stays out of the schema. Its Passage item is rebuilt to route through the controller (see `passageSuggestionFor`). |
| `AbbreviationCommand` | editor | Commands only. Needed because `AbbreviationSuggestion` calls `insertAbbreviation`; the two travel together. |
| `GlobalConfig` | omitted | A debug flag in editor storage that nothing anywhere reads. Left out rather than carried for symmetry. |
| `StarterKit` `trailingNode` | off | A trailing node exists only in live editors, so it would make a passage grow on focus and shift every row below it. Gap cursor still allows insertion after a trailing table or line group. |
| `StarterKit` `undoRedo`, `Collaboration` history | off | Undo goes through the work's command log so text and structural edits interleave in one history. |

### Per-editor vs shared

Only one passage is editable at a time — neighbours premount non-editable so
boundary arrow keys land in a real editor. That is what decides this:

| Concern | Verdict |
|---|---|
| Schema, marks, node views | **Per editor.** Each passage parses and renders its own content. |
| `Collaboration` binding, `UndoManager` | **Per editor**, but the manager belongs to the `PassageDoc` and outlives every mount — see the note in `PassageStackController.wire`. |
| `BoundaryKeymap`, `SlashCommand` | **Per editor.** Both act on the focused passage and need its uuid. |
| `TranslationBubbleMenu` | **Shared.** It follows a selection, and only one editor carries one. N mounted menus would be N popovers watching nothing. |
| `PassageMenuOverlay` | **Shared**, and no longer editor-driven: the label lives in `StackRow` outside the editor, so the trigger and the actions belong to the controller and the spine. |
| `MentionAdvancedOverlay` | **Shared**, bound to whichever editor has focus. |
| `DragHandle` | Not in the production translation set either. Out of scope. |

Mounting the three shared surfaces needs `NavigationProvider` and the reader
cache in scope, or their selectors throw — see
`.harness/decisions/2026-08-19-sandbox-editors-lack-editor-providers.md`, which
is the same trap in the `web-editor` sandbox pages.
