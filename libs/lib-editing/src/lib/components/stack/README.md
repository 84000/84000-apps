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
  `getSchema` feeds to `PassageDoc`, so it governs how content is **parsed**.
  Only schema-contributing extensions belong here.
- **`buildStackEditorExtensions`** — the schema set plus commands, plugins and
  the Yjs binding. Mounted per live editor.

Static rows are **not** rendered from either list. They go through
`renderTranslationHTML`, the reader's own renderer, because drawing needs a
different set from parsing: the `*.ssr` variant of every extension whose
interactive form draws through a React node view (a node view renders nothing
to a string), plus the `endNoteLink` mark mapping, which is the only thing that
emits its markers at all. Rendering static rows from the schema set dropped
endnote markers from every row while the editor showed them, and rendered
internal links differently — parity with read-only mode is by construction now
rather than by keeping two lists in step.

### Differences from the production set

| Extension | Where | Why |
|---|---|---|
| `TranslationDocument` → `StackDocument` | schema | A passage's children *are* the document. Its top node is `block+`. |
| `PassageNode` | absent | Passage identity (uuid, label, sort, type, toh) lives in the spine, not in a wrapping node. Its `splitPassage` / `normalizeLabelsAfter` commands become `WorkDocument.split` and spine renumbering. |
| `AnnotationToh` | schema | The intentional declaration of the `toh` attribute, tied to `ANNOTATION_TOH_TYPES` — which is why `translationSSRExtensions` carries it and no `TranslationMetadata`. Belt and braces in this list: `TranslationMetadata` declares `toh` on every type as a side effect of declaring uuid/type/invalid, so retention does not depend on it (verified both ways). Kept so dropping `TranslationMetadata` could not silently take toh scopes with it. |
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

### Keys at a passage boundary

| Key | Behaviour |
|---|---|
| Enter at the end | Starts a **paragraph**, as it does anywhere else. A passage boundary is not a reason for Enter to mean something different. |
| Enter again, in that empty paragraph | Starts a new passage, dropping the empty paragraph so the head does not end in a blank line. An Enter in an already-empty passage is still the *first* press, so the gesture is always two. |
| Slash menu → Passage | The same split, directly. |
| Backspace at the start | Merges into the previous passage and puts the caret at the join. |
| Backspace at an inner block start | Joins into the block before it. Where a join is impossible — a heading, a table, a line group — it does nothing rather than letting ProseMirror fall through to `selectNodeBackward`, which selected the whole preceding block, showed the bubble menu over it, and made the next Backspace delete it. |

A caret position handed over by the doc model is a document offset, not
necessarily somewhere a caret can sit: a merge's boundary is the size of the
head's content, which falls *between* two blocks. `focusEditor` resolves it with
`TextSelection.near` so the caret lands in real text — at a join, the end of the
head. Left unresolved the caret was in no textblock at all, which is what made
the Backspace above misbehave in the first place.
| `TranslationBubbleMenu` | **Shared**, mounted once by `PassageStack` and bound to `getFocusedEditor()`. It follows a selection and only one editor carries one, so N mounted menus would be N popovers watching nothing. Keyed on the focused uuid so it rebinds rather than holding a stale editor. |
| `PassageMenuOverlay` | **Shared**, and no longer editor-driven: the label lives in `StackRow` outside the editor, so the trigger and the actions belong to the controller and the spine. |
| `MentionAdvancedOverlay` | **Shared**, bound to whichever editor has focus. |
| `DragHandle` | Not in the production translation set either. Out of scope. |

### Annotation toh scopes

DEV-757 fixed `passage_annotations.toh` being stripped from every annotation on
the first save of its passage. The stack materializes rows through the same
exporters, so the scope has to survive hydrate → edit → materialize; that round
trip is asserted directly rather than inferred from which extensions are
present. The rendering half — `data-toh`, which the reader's toh-visibility rule
reads — is asserted through `renderTranslationHTML`, the path a static row
actually takes.

### Providers a host must supply

`TranslationBubbleMenu` needs a `NavigationProvider` above it, for
`EndNoteSelector`. The stack does not mount one itself: `web-main` already does
through `EditorContextProvider`, and a nested provider would shadow it with a
different work. `NavigationProvider` is re-exported from this subpath so a host
does not have to import the main `lib-editing` barrel as well — importing both
loads yjs through two entry points, which is what produces "Yjs was already
imported. This breaks constructor checks".

A missing provider does **not** announce itself. `NavigationContext` is created
with a complete default object, so the menu renders and every one of its
controls opens; what the defaults hand out is `uuid: ''` and stubs that throw
only when invoked. Verified in a browser both ways. See
`.harness/decisions/2026-09-02-navigation-context-degrades-it-does-not-throw.md`,
which corrects the mechanism described in the earlier
`2026-08-19-sandbox-editors-lack-editor-providers` note.
