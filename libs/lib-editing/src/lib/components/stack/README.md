# The passage stack

One TipTap editor per passage, mounted only where focus is, over the
per-passage document model in `@eightyfourthousand/lib-doc-model`.

`PassageStackController` coordinates a passage document display while `WorkDocument`
manages the spine, the passage documents, split/merge/delete and the command log.
See its class comment for the two windows (hydration is scroll-driven, the live
editor set is focus-driven) and why they are separate.

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

| Extension                                        | Where   | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TranslationDocument` → `StackDocument`          | schema  | A passage's children _are_ the document. Its top node is `block+`.                                                                                                                                                                                                                                                                                                                                                                                  |
| `PassageNode`                                    | absent  | Passage identity (uuid, label, sort, type, toh) lives in the spine, not in a wrapping node. Its `splitPassage` / `normalizeLabelsAfter` commands become `WorkDocument.split` and spine renumbering.                                                                                                                                                                                                                                                 |
| `AnnotationToh`                                  | schema  | The intentional declaration of the `toh` attribute, tied to `ANNOTATION_TOH_TYPES` — which is why `translationSSRExtensions` carries it and no `TranslationMetadata`. Belt and braces in this list: `TranslationMetadata` declares `toh` on every type as a side effect of declaring uuid/type/invalid, so retention does not depend on it (verified both ways). Kept so dropping `TranslationMetadata` could not silently take toh scopes with it. |
| `SlashCommand`                                   | editor  | A plugin, so it stays out of the schema. Its Passage item is rebuilt to route through the controller (see `passageSuggestionFor`).                                                                                                                                                                                                                                                                                                                  |
| `AbbreviationCommand`                            | editor  | Commands only. Needed because `AbbreviationSuggestion` calls `insertAbbreviation`; the two travel together.                                                                                                                                                                                                                                                                                                                                         |
| `GlobalConfig`                                   | omitted | A debug flag in editor storage that nothing anywhere reads. Left out rather than carried for symmetry.                                                                                                                                                                                                                                                                                                                                              |
| `StarterKit` `trailingNode`                      | off     | A trailing node exists only in live editors, so it would make a passage grow on focus and shift every row below it. Gap cursor still allows insertion after a trailing table or line group.                                                                                                                                                                                                                                                         |
| `StarterKit` `undoRedo`, `Collaboration` history | off     | Undo goes through the work's command log so text and structural edits interleave in one history.                                                                                                                                                                                                                                                                                                                                                    |

### Per-editor vs shared

Only one passage is editable at a time — neighbours premount non-editable so
boundary arrow keys land in a real editor. That is what decides this:

| Concern                                | Verdict                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Schema, marks, node views              | **Per editor.** Each passage parses and renders its own content.                                                                      |
| `Collaboration` binding, `UndoManager` | **Per editor**, but the manager belongs to the `PassageDoc` and outlives every mount — see the note in `PassageStackController.wire`. |
| `BoundaryKeymap`, `SlashCommand`       | **Per editor.** Both act on the focused passage and need its uuid.                                                                    |
| `TranslationBubbleMenu`                | **Shared**, mounted once by `PassageStack` and bound to `getFocusedEditor()`. It follows a selection and only one editor carries one, so N mounted menus would be N popovers watching nothing. Keyed on the focused uuid so it rebinds rather than holding a stale editor. |
| `StackPassageMenu`                     | **Shared**, and not editor-driven at all — see below.                                                                                |
| `MentionAdvancedOverlay`               | **Shared**, bound to whichever editor has focus, keyed the same way. The prefix on that key is load bearing: two siblings keyed on the same uuid are two children with the same key. |
| `DragHandle`                           | Not in the production translation set either. Out of scope.                                                                          |

### Row chrome

`StackRow` is permanent, not scaffolding. Production draws a passage's label
from `PassageNode`'s node view, inside the document; passage identity lives in
the spine here, so the chrome is React around the editor. The row carries the
same classes and hooks either way — `.labeled` on the label,
`PASSAGE_CONTENT_CLASS` on the content, `id`, `data-passage-label` and
`data-uuid` — because the things that key off them are not all in this package:
deep links resolve a passage by `id` and then look for `.passage.is-editable`
inside it.

Two deliberate differences:

- **The label gutter is padding, not `-left-16`.** The stack scrolls in a
  container whose `overflow-y: auto` makes `overflow-x` auto too, so a label at
  a negative offset is clipped rather than drawn in the page margin. Same
  gutter, same 24px to the text, reached from the other side.
- **`select-none` on the label.** In production the label is node view chrome,
  which ProseMirror leaves out of a copied slice. Static rows are copied
  natively, so without this a drag across them picks up the labels.

`StackPassageMenu` is the passage label menu. Production drives it from a
ProseMirror click plugin matching `[data-passage-label]`; the trigger is an
ordinary React click here, so `editor.storage.passage.openMenu`, the plugin and
`findPassageNode` have nothing to do. The actions go to the work and the spine
for the same reason a label does: `setPassageLabel` becomes
`WorkDocument.setLabel`, and deleting a passage becomes `WorkDocument.remove`
rather than a transaction over a node.

Deleting moves focus onto the passage that takes the deleted one's place. It has
to: a focused uuid the spine no longer holds leaves every shared surface bound
to a row that is not drawn.

Not carried over, and why:

| | |
| --- | --- |
| The bookmark indicator, and `ReaderOptions` | Both are `!editable` chrome. The reader still runs on `TranslationEditor`; migrating it is a follow-up issue. |
| The references list | Endnote back-links, and the only source for them is `Passage.references`, which neither the spine's metadata query nor the passage snapshot carries. Worth its own measurement rather than a field added on the way past. |
| The compare source column | Compare mode is DEV-743's, and its surface is undecided. |
| `data-toh` on the row | The toh visibility rule is `display: none`, and a virtualized row is absolutely positioned at a measured offset. Hiding one leaves a hole. Which passages a toh shows is a question about spine order, not about CSS. |
| Endnote per-slot renumbering | `deleteEndnotePassageNode` keeps one label across the per-text variants of an endnote slot; `Spine.renumberFrom` numbers every passage. Only visible in the endnotes panel, which the stack does not surface yet. |

### Keys at a passage boundary

| Key                                  | Behaviour                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Enter at the end                     | Starts a **paragraph**, as it does anywhere else. A passage boundary is not a reason for Enter to mean something different.                                                                                                                                                                            |
| Enter again, in that empty paragraph | Starts a new passage, dropping the empty paragraph so the head does not end in a blank line. An Enter in an already-empty passage is still the _first_ press, so the gesture is always two.                                                                                                            |
| Slash menu → Passage                 | The same split, directly.                                                                                                                                                                                                                                                                              |
| Backspace at the start               | Merges into the previous passage and puts the caret at the join.                                                                                                                                                                                                                                       |
| Backspace at an inner block start    | Joins into the block before it. Where a join is impossible — a heading, a table, a line group — it does nothing rather than letting ProseMirror fall through to `selectNodeBackward`, which selected the whole preceding block, showed the bubble menu over it, and made the next Backspace delete it. |

A caret position handed over by the doc model is a document offset, not
necessarily somewhere a caret can sit: a merge's boundary is the size of the
head's content, which falls _between_ two blocks. `focusEditor` resolves it with
`TextSelection.near` so the caret lands in real text — at a join, the end of the
head. Left unresolved the caret was in no textblock at all, which is what made
the Backspace above misbehave in the first place.
### Toh visibility a host must supply

A work may span several Tohoku texts — toh145's spans four — and annotations
carry a `toh` scope. Something has to install the visibility rule that hides
the inactive ones, or every scope shows at once: two endnote markers numbered
10, one for toh145 and one for toh847, both visible.

`web-main` gets that from `LeftPanel`. A host without that panel calls
`useStackTohVisibility({ tohList })`, which installs the rule and settles on a
default so one toh is always active. The active toh itself comes from
`NavigationProvider`, which already reads `?toh=` and falls back to its
`initialToh`.

The stack does not do this unprompted: with no `NavigationProvider` above it the
active toh would be `undefined`, and the rule for that hides _all_ scoped
markup — worse than doing nothing.

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
