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

| Concern                                | Verdict                                                                                                                                                                                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema, marks, node views              | **Per editor.** Each passage parses and renders its own content.                                                                                                                                                                                                           |
| `Collaboration` binding, `UndoManager` | **Per editor**, but the manager belongs to the `PassageDoc` and outlives every mount — see the note in `StackRowContent.wire`.                                                                                                                                             |
| `BoundaryKeymap`, `SlashCommand`       | **Per editor.** Both act on the focused passage and need its uuid.                                                                                                                                                                                                         |
| `TranslationBubbleMenu`                | **Shared**, mounted once by `PassageStack` and bound to `getFocusedEditor()`. It follows a selection and only one editor carries one, so N mounted menus would be N popovers watching nothing. Keyed on the focused uuid so it rebinds rather than holding a stale editor. |
| `StackPassageMenu`                     | **Shared**, and not editor-driven at all — see below.                                                                                                                                                                                                                      |
| `MentionAdvancedOverlay`               | **Shared**, bound to whichever editor has focus, keyed the same way. The prefix on that key is load bearing: two siblings keyed on the same uuid are two children with the same key.                                                                                       |
| `DragHandle`                           | Not in the production translation set either. Out of scope.                                                                                                                                                                                                                |

### Row chrome

`StackRow` is permanent, not scaffolding. Production draws a passage's label
from `PassageNode`'s node view, inside the document; passage identity lives in
the spine here, so the chrome is React around the editor. The row carries the
same classes and hooks either way — `.labeled` on the label,
`PASSAGE_CONTENT_CLASS` on the content, `id`, `data-passage-label` and
`data-uuid` — because the things that key off them are not all in this package:
deep links resolve a passage by `id` and then look for `.passage.is-editable`
inside it.

The label hangs in the margin at `-left-16`, exactly as production draws it, so
the content keeps the full width of the column. The stack imposes no width of
its own: a host that already constrains the column — `BodyPanel` does, for the
paginated editor — would otherwise constrain it twice, and the text would come
out a hundred pixels narrower than the editor beside it.

One deliberate difference:

- **`select-none` on the label.** In production the label is node view chrome,
  which ProseMirror leaves out of a copied slice. Static rows are copied
  natively, so without this a drag across them picks up the labels.

The bookmark indicator comes from the bookmark store rather than from an
editor, and shows only when the controller is `readOnly` — the same condition
as production's `!editable`, because a bookmark is a reader's marker and the
studio has no way to make one. Bookmarks are local storage, so `PassageStack`
listens for `storage` and has the controller re-read.

`readOnly` makes the stack a reader's. See [Read-only mode](#read-only-mode).

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

|                              |                                                                                                                                                                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The references list          | Endnote back-links, and the only source for them is `Passage.references`, which neither the spine's metadata query nor the passage snapshot carries. Worth its own measurement rather than a field added on the way past.                                                           |
| The compare source column    | Compare mode is DEV-743's, and its surface is undecided.                                                                                                                                                                                                                            |
| `data-toh` on the row        | Correct, but the wrong mechanism: the annotation rule is `display: none`, and the virtualizer keeps a row's last measured size, so hiding one leaves a hole the size of the passage. Which passages a toh shows is a question about order — `getOrder` now filters them, see below. |
| Endnote per-slot renumbering | `deleteEndnotePassageNode` keeps one label across the per-text variants of an endnote slot; `Spine.renumberFrom` numbers every passage. Only visible in the endnotes panel, which the stack does not surface yet.                                                                   |

### Read-only mode

A read-only stack is the reader's: no row ever mounts an editor and nothing
changes the work. Every row stays static HTML, so there is no
`contenteditable`, bubble menu, slash command, mention overlay or undo handler
anywhere on the page. Hover cards still open, without their edit actions, and
a glossary term or mention still opens its panel.

A host sets it on `StackWorkProvider`:

```tsx
<StackWorkProvider workUuid={work.uuid} readOnly={readOnly}>
```

and every view the provider builds follows it. `useStackWork()` reports it as
`readOnly`. A view built directly takes `readOnly` in its options.

What changes with it:

- **Rows.** `isLive` is false for every row, `focusPassage` refuses and
  `requestEditorFor` resolves null, so a click or a hover card's edit action
  mounts nothing.
- **The work.** Split, merge, delete, relabel, the passage selection's cut and
  paste, undo and redo all refuse, and so does every bibliography outline edit.
- **Selection.** The stack's passage selection is off. With no editors the
  browser's own selection crosses rows, as it does in the paginated reader.
- **The label menu.** `StackReaderMenu` replaces `StackPassageMenu`: bookmark,
  copy link and suggest revision, as `ReaderOptions` offers in the paginated
  reader. Bibliography rows have no label menu when read-only.

**It can change while the stack is drawn.** The provider calls
`PassageStackController.setReadOnly` on every view when the prop changes, so the
work, its spine and the scroll position are kept. Turning read-only blurs and
releases every live editor and clears any passage selection, and the rows
redraw as static HTML. Edits already made live in the work, not the editors, so
they are kept and the save handler stays registered to write them. Turning it
off again takes effect on the next click.

The host owns the rest of the reader's surface, on `NavigationProvider`:

- `editable` decides whether hover cards offer their edit actions, so it should
  be `!readOnly`.
- `hoverCards` decides whether cards are drawn at all. It defaults to
  `editable`, which keeps the paginated reader without them, so a read-only
  stack passes `hoverCards` to keep its cards. A reader gets no card for an
  internal link, whose card shows only its raw target. The sandbox's `/stack/[toh]/tabs` takes `?readonly=1` and has a
  button that switches it live.

### A reader without the editor

`StackWorkProvider` and `PassageStackController` carry the editor, read-only or
not. A host that only reads uses `StackReaderProvider` and the `reader.ts`
entry instead, which load none of it: no live-editor rows, menus, slash or
mention UI, collaboration or y-sync plugin, and no `EditorProvider` from the
stack.

The split is by injection. `StackController` is the view without an editor; it
is always read-only and throws if asked to build one. `PassageStackController`
is the same class handed the editing layer (`stack-editing.tsx`: the editor
extensions, the live-row component, the menus and the y-sync origin), and
`PassageStack` draws the editor's pieces from the view it is given.

`stack-reader-graph.spec.ts` bundles `reader.ts` and fails if anything editor-only
comes back into its static imports. What remains is shared with the existing
readers: `@tiptap/react` through the schema extensions and the hover cards.

### Static passages outside the stack

`StaticPassage` draws one passage read-only, outside any stack, with the same
renderer and classes a static row uses, so a passage reads and wraps as it does
in the stack. It mounts no editor and draws no row chrome: no label, no `id`,
no `data-stack-passage`, so it cannot be mistaken for a stack row by deep
links or the stack's delegated handlers.

```tsx
// Reads the passage itself.
<StaticPassage uuid={uuid} workUuid={workUuid} />
// Or from content the caller already holds.
<StaticPassage uuid={uuid} workUuid={workUuid} json={passage.json} />
<StaticPassage uuid={uuid} workUuid={workUuid} html={html} />
```

Underneath it are two functions for a caller that wants the HTML itself, for
instance to mark search matches in it:

- `renderStaticPassageHTML(json)` renders a passage's content to the HTML a
  static row draws. It takes the passage node the API serves as `json`, or the
  passage's blocks. Pure, and free of editor code.
- `loadStaticPassages({ client, workUuid, uuids })` reads the passages of one
  work in pages of 100 and returns their HTML by uuid. A list showing many
  passages should read the ones in view through this, in one call, and pass
  each `html` in, rather than letting each `StaticPassage` read its own.

`StaticPassageHTML` is the element both draw: the HTML with the row's classes.

### Keys at a passage boundary

| Key                               | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enter at the end                  | Starts a **paragraph**, as it does anywhere else. A passage boundary is not a reason for Enter to mean something different.                                                                                                                                                                                                                                                                                                               |
| Enter again, in that empty block  | Starts a new passage, moving the empty block into it so the head does not end in a blank line. At the end of a line group the first Enter adds an empty line, and the second moves that line out of the group as a paragraph, so the new passage starts with a paragraph. An Enter in an already-empty passage is still the _first_ press, so the gesture is always two. Lists keep their own Enter, which lifts an empty item out first. |
| Slash menu → Passage              | The same split, directly.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Backspace at the start            | Merges into the previous passage and puts the caret at the join.                                                                                                                                                                                                                                                                                                                                                                          |
| Backspace at an inner block start | Joins into the block before it. Where a join is impossible — a heading, a table, a line group — it does nothing rather than letting ProseMirror fall through to `selectNodeBackward`, which selected the whole preceding block, showed the bubble menu over it, and made the next Backspace delete it.                                                                                                                                    |

A caret position handed over by the doc model is a document offset, not
necessarily somewhere a caret can sit: a merge's boundary is the size of the
head's content, which falls _between_ two blocks. `focusEditor` resolves it with
`TextSelection.near` so the caret lands in real text — at a join, the end of the
head. Left unresolved the caret was in no textblock at all, which is what made
the Backspace above misbehave in the first place.

### Sections

`StackWorkProvider` seeds one run per tab — Front, Translation, Abbreviations,
Endnotes — in the order the work reads, since an empty run is placed at the end
of the spine. Every work with abbreviations has them between the body and the
notes.

Abbreviation entries are plain paragraphs whose key is an inline
`abbreviation` node, so the design system's
`.paragraph:has(> [type='abbreviation'])` rule draws them in two columns in both
tiers. Abbreviations carry no label, so a new entry or header is given none.
Under the stack the panel reads neither tab's content: it asks only whether
each has any passages, to know whether to show it.

Tabs in one panel share its scroller, and an inactive tab stays mounted, only
hidden. A hidden stack still reads the shown tab's scroll offset, so it reports
no visible range until it is laid out again: otherwise scrolling deep in
Translation would page and hydrate the front matter.

The titles and imprint above the front matter are drawn only while the Front
run starts at its first passage, which `useStackOuterContent` reports — not over
a window a deep link opened part way through it.

A new endnote is numbered after the nearest link before it in reading order,
which runs back through earlier tabs: front matter links notes too. The search
does not depend on which tabs have been visited. Passages in the spine that the
stack does not hold are hydrated through the store, and passages past either
end of a run are read through that run's controller (`readBeyond`) without
moving its window. A read that fails refuses, instead of guessing a number.

The right panel's Notes and Abbreviations are both stacks, so a hash there is
answered only by the one shown, and each is restored by its passage anchor on
a tab switch, as the main panel's tabs are.

### The stack does not own a scroller

It virtualizes against the nearest scrollable ancestor. Its hosts already have
one — the editor's resizable panel, the sandbox's frame — and creating a second
is how the worst bug in this component happened: `h-full` on the stack root is
`height: 100%`, every wrapper between it and web-main's panel has auto height,
so it resolved to `auto`. The scroller grew to fit its own content and never
scrolled, which meant every row counted as visible, the virtualizer drew all of
them, the visible range always reached the end of the spine, and the feed kept
fetching. Fifteen thousand passages, from one percentage height.

A host therefore owes the stack a scrollable ancestor with a bounded height.
`scrollMargin` accounts for whatever sits above it in that scroller — tabs,
titles — because the virtualizer measures from the scroller, not from the
stack.

It is re-measured, not taken once. What sits above can change height long
after mount — a title or an imprint arriving — and a stale margin offsets
every row _and_ every scroll by that much, silently: rows still render and a
deep link still scrolls, just to the wrong place. Adding 260px above a settled
stack moved a revealed row by exactly 260px, which on web-main reads as landing
a couple of passages short. Watching the scroller alone does not see it, since
a `ResizeObserver` reports an element's own box and not its content's; what can
move the stack down is its own ancestors up to the scroller, and the scroller's
other children, so those are what is observed.

None of the harness routes caught it, because each one wrapped the stack in an
explicit height. `?unbounded=1` on `/stack/[toh]` reproduces web-main's nesting
instead, and is the regression test: with the stack owning a scroller it loads
the entire work, and without it loads one page.

### Rows in flow, and the first window on the server

The window of drawn rows is laid out in normal flow, inside a list padded down
to where the window starts, rather than each row absolutely placed at its own
measured offset. So the space between two drawn rows is the rows themselves,
never an estimate.

That is what lets a server draw the stack. With no scroller and no layout, the
virtualizer works from an assumed viewport (`initialRect`, 1200px plus the
overscan) and from estimated heights; the window starts at the top, so its
offset is the same before and after anything is measured, and the browser's
first render matches the server's. Measuring then corrects only the list's
total height below the window, which is a `min-height`: a row taller than its
estimate pushes what follows down rather than overlapping it.

Each row is its own formatting context (`flow-root`), as an absolutely placed
one was, so a passage's outer margins do not collapse into its neighbour's.
Rows are no longer one stacking context each; nothing in a row sets a z-index
that would notice.

### Hover cards are a document-level surface

A card needs no editor. Its content comes from the navigation fetchers by uuid
and from the anchor's own attributes, and detection is a delegated listener
over the whole subtree — all three are already document level. The only thing
that genuinely needs an editor is _editing_, and that is resolved when an
action runs: `requestEditorFor` focuses the passage, which mounts it.

What used to decide whether a card appeared was whether the anchor resolved to
an **editable editor instance** — a per-instance answer to an
application-level question. In the paginated editor, where one editable editor
covers the whole panel, the two coincide. In the stack they do not: most rows
are static HTML, so cards simply stopped existing for them, and premounted
neighbours are non-editable, so they had none either.

The switches are now application-level, set by the host on
`NavigationProvider`: `hoverCards` for whether cards are drawn, and `editable`
— the studio rather than the reader — for whether they offer edits. Detection in the mark and
node views is unconditional for the same reason: an anchor that hides itself
from detection cannot be reconsidered later, and whether to offer a card is
not its decision to make.

This is why hovering costs nothing. An earlier version of this mounted an
editor under the pointer so the old check would pass, which meant a second
`contenteditable` on the page and an editor per hovered row. Verified instead:
a card opens over a static row with zero editors mounted anywhere.

### The loading state

A row that cannot draw its content yet draws `PassageSkeleton` instead — both
tiers, because a live editor renders an empty box until it mounts
(`immediatelyRender` is off) and a row that keeps its height and shows nothing
reads as content that failed rather than content arriving.

Three things it has to get right:

- **It is what the virtualizer measures.** So it is drawn at the row's
  estimated height, not a token height: a short placeholder does not get
  corrected, it _becomes_ the row's height until the passage hydrates.
- **It is one block per passage, not ruled lines.** A passage is a block of
  text, and a placeholder that draws individual lines is inventing a shape it
  does not know — line breaks depend on the column width. The space between
  blocks is a transparent bottom border rather than a margin: the row has no
  padding by design, so a margin would collapse out of it and the block would
  stop measuring its own height. `data-passage-skeleton`
  records whether the height came from the passage's own length or from the
  fallback, so a mis-sized row can be traced back to whether a size existed.
- **It comes from the design system's `Skeleton`, not a bare `animate-pulse`.**
  That carries
  `data-skeleton`, which the WebKit guard keys off to stop the animation: a
  running animation during a large DOM subtree replacement can wedge WebKit's
  main thread, and a virtualized list replaces subtrees continuously. It also
  means one animation per row rather than one per line.

The colour is `bg-foreground/10`, as the design system's own `Skeleton` uses.
`bg-muted` — what this drew at first — resolves to the studio's page background,
so the placeholder was there, sized correctly, and completely invisible.

### Mapping a DOM point into a passage

A live row has `posAtDOM`. A static row has to count, and counting rendered
characters is wrong: some annotations render text the document does not hold,
and they are exactly the two stored with a zero-length range — an endnote
marker is a decoration with no document text at all, and a mention is an inline
node whose label lives in its attributes. Measured on toh145 that is three
characters per marker and four per mention.

So both sides count the same units. `domOffsetWithin` walks the DOM adding a
unit per character, none for an endnote marker, and one for a mention;
`posFromTextOffset` walks the document adding one per character and one per
inline node that holds no content. Keyed on holding no content rather than on
`isAtom`, which this schema's mention does not set.

Getting this wrong is quiet. The selection looks right and registers as a
cross-passage selection; only the delete cuts the wrong range.

### Content links on a static row

A mounted editor handles glossary instances, endnote markers, internal links
and mentions from its own mark and node views. A static row has none, so
`PassageStack` follows them by delegation, reading the intent back out of the
attributes the `*.ssr` renderers emit — which is what makes those attributes a
contract rather than presentation.

Three things this has to get right, each of which the obvious version gets
wrong:

- **It resolves on `mousedown` but acts on `mouseup`.** The element has to be
  read while it is live, because focusing swaps the row for an editor and
  detaches it. Acting there too is what broke text selection: a press on a
  link is just as likely to begin a drag, and both following the link and
  calling `preventDefault` stop the browser ever starting one. Resolving early
  and acting late needs no element at release, which is what the original
  reason for using `mousedown` was really about.
- **The anchor's own default is prevented on `click`.** `preventDefault` on
  `mousedown` does not stop a link loading its `href`; only the click does.
  Without it a static internal link navigates out of the app entirely.
- **It goes through `updatePanel`, not `history.pushState`.** The panels are
  React state and `NavigationProvider` writes the URL from it, so a link that
  pushed history directly is overwritten by the next sync. `useSearchParams`
  does not observe a manual history write either, so nothing reads it back.

`resolveStackLink` is therefore pure: it reports where a link goes and leaves
navigating to the stack. A target it cannot route resolves to null and the link
is left alone, rather than navigating somewhere arbitrary.

The one thing the static HTML did not carry is a same-work mention's highlight
range, which lived only in the model; `Mention.ssr` now emits it.

### Reading a window without over-reading it

`AROUND` splits its limit either side of its cursor, so reading a run from its
first passage had to ask for twice the run and throw the leading half away —
on every hydration, including plain scrolling.

It is only needed where no predecessor is held. Within a section's run the
spine entry before a passage _is_ the passage before it in the work, so that
entry is an exclusive cursor and the run reads forward at exactly its length.
`AROUND` stays as the fallback for a run that opens a section, or a spine that
opens mid-work after a deep link — which is the case the original note was
about, and the case a distance-based check would get wrong.

The spine can hold a gap the server does not: a passage removed locally is
still there to be read. So a forward read checks it actually covered the run
and continues if it fell short, the same way the `AROUND` path already does.

Measured over one load and eight screens of scrolling on toh145: 445 KB of
passage content before, 277 KB after, and nine of the eleven reads stop costing
the server the two parallel queries an `AROUND` needs.

### Deep links

A link names a passage, not a position, and the spine window rarely holds it.
`useStackDeepLink` reads the panel hash a `NavigationProvider` parses and hands
it to `revealPassage`, which moves the window rather than paging to the target
— production has no spine and simply swaps the editor's content, so this is the
equivalent. `?start`/`?end` paint the same range highlight.

A hash is addressed to a **panel**, and only the stack drawn in that panel can
answer it — so which panel a view watches follows its own tab, via
`PANEL_FOR_TAB`. Defaulting every view to `main` left the endnotes stack
watching a panel it is not in: an endnote link set `right`'s hash, the tab
opened, and nothing scrolled. A host that places a tab somewhere unusual passes
`panel` to override it.

Front and Translation are both stacks in `main`, so a panel's hash is answered
only by the stack for its active tab — a panel naming no tab is showing its
default. A feed asked to reveal a passage from another section leaves its run
alone: a filtered `AROUND` centres on the cursor's position, so it still
returns a page of the wrong section.

A hash that is not a uuid names something above the run rather than a passage
— the table of contents links the imprint by name. The run is moved back to its
start, the element scrolled to, and the hash cleared; kept, no stack could ever
answer it.

Neither move replaces a run that holds unsaved passages — an edited document,
or one created and not saved. A passage taken out of the spine is out of the
save, and a new one's sort comes from its neighbours, so the feed grows the
window toward the target a page at a time instead. That costs a page per
hundred passages in between, paid only while there is something to keep.

Three things that each cost a debugging pass:

- **The scroll has to settle, and stillness is not the signal.** Rows above an
  unvisited target are estimates, and measuring them moves it — by a
  screenful. Re-issuing the scroll for a fixed number of frames is not enough:
  hydration arrives over hundreds of milliseconds and its last page can land
  seconds later, by which time any frame budget has run out. Measured on a
  throttled deep link, the target sat correctly for two seconds and then jumped
  912px out of view as the final rows measured.

  So the anchor is held until the page stops moving, re-armed by anything that
  changes the view, and released only once the offset, the controller's version
  _and_ `isHydrating` all agree there is nothing left to come. The last of
  those is load bearing: between issuing the scroll and the content landing the
  page is perfectly still, and letting go in that gap is exactly when the drift
  happens.

  It yields immediately to a reader who scrolls. Holding a position against
  someone trying to leave it is worse than the drift.

- **Upward paging waits for the top.** Downward loads ahead of a fast scroll;
  upward cannot, because a prepend moves every row below it. It is also
  disarmed while a reveal is in flight and again while a prepend lands, or the
  list renders at index 0 for a frame and asks for a page nobody wanted.
- **A prepend is re-anchored through the virtualizer**, on the row that used to
  be first. Anchoring on a DOM row does not work: a hundred prepended rows push
  it out of the rendered window, so there is nothing left to measure.

The spine starting mid-work also changes what index 0 means. `passage-source`
used to read from the beginning of the work when a run began at the top of the
spine; that is now a different part of the text, so the boundary row is read
with `AROUND`, which includes its own cursor.

### Which rows a toh shows

A work can span several Tohoku texts, and a passage may be scoped to one of
them: toh145 and toh847 each carry their own endnote n.10. Drawing both is
wrong under either reading, and it is what the stack did.

The view filters them out of `getOrder`, rather than hiding them with CSS as
the annotation rule does — the virtualizer keeps a row's last measured size,
so `display: none` leaves a hole rather than closing the gap.
Rows are indexed within the tab and hydration within the work, and `spineRange`
maps between them through the first and last _visible_ uuid, so a filtered row
costs at most a passage of over-fetch at the window's edges.

Most passages carry no scope and belong to every reading. Until a toh is named
at all, every row is drawn: hiding all scoped rows because nothing has scoped
yet is worse than doing nothing, which is the same conclusion the annotation
rule reaches.

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

### Rows that are not passages

The spine, feed and loader are not tied to passages. A second entity brings
three things:

- **Row types.** `PassageMeta.type` is a `StackRowType`, which adds
  `bibliographyHeader` and `bibliography` to the body item types. Placement
  folds `*Header` into its section as before, so both land in the
  `bibliography` tab, and `rowKindOf` reads heading or entry the same way.
  `parent` and `depth` carry nesting, and are stored only when set.
- **A feed.** `RowFeed` is the windowing logic over any `RowPages` reader;
  `SpineFeed` is that over the API's passages, unchanged. The controller takes
  any `StackRowFeed`.
- **A source and a schema.** `createStackWork` takes a `source` and
  `extensions` in place of the API's passages and the passage schema.

Bibliography entries are stored as HTML, so `bibliography-codec` reads
`bibl_html` into a row's blocks and writes them back. It parses with whitespace
preserved in full, so newlines, runs of spaces and soft hyphens survive, and
serializes without the editor's presentation: a bare `<p>` and `<a href>`, as
entries are stored. A heading is stored as plain text and read as text: its
marks are dropped and its paragraphs joined with a space. Every seeded row
round trips byte for byte. The documented normalisations: whitespace between
paragraphs is dropped and a link keeps only its `href`.

The bibliography schema leaves out `TranslationMetadata`, which mints a uuid
for every parsed node and mark: stored HTML would change on every read. A
comment anchor is a `comment` mark in the row's HTML and keeps its own uuid.
Formatting marks rank above links, so they wrap a link as stored entries do.

#### The bibliography tab

`StackWorkProvider` reads a work's bibliography into a `WorkDocument` of its
own (`bibliography-work`), not the passages' work: its rows are not passages,
so they save, and undo, apart from them. All rows are read at once and seeded
in the readers' order, each heading followed by its entries, so a deep link to
any row is already in the spine and no feed is needed. Labels and nesting
come from `outlineBibliography`, as the readers number them.

The work document takes an `outline`, which derives every row's label, parent
and depth from the order after each change, so they are never recorded in the
history. `outlineBibliographyRows` numbers the order as `outlineBibliography`
numbers the stored rows: an entry belongs to the heading before it, and a
heading keeps the parent it is given. The edits in `bibliography-structure`
keep that true: a new heading follows its heading's block (or goes first in a
work with none), a heading is deleted only once nothing is under it, and
indent, outdent and move carry a heading's block with it, through
`WorkDocument.nest`, as one undo step.

Its controller is built with `rows: 'bibliography'`, and the editor mounts the
bibliography schema rather than the passage set. A heading's editor is a
single line of plain text (its schema has no marks, and a paste flattens to
text), and Enter in it starts the heading's first entry. An entry splits on
Enter-Enter and merges into the entry before it, never into a heading, and its
slash menu starts an entry, a heading or a subheading. `BibliographyRowMenu`,
on the row's label, starts rows, indents and outdents a heading, moves a row
under another heading, and deletes it; the delete dialog counts the mentions
of the row it would leave unresolved. Passage paste, run deletes and the
passage label menu stay off, and the bubble menu offers inline marks only.
A read-only controller changes no structure. `rowStyle` draws headings as the
readers do and indents nested rows by depth.

Undo and redo from outside an editor take the history of the work whose row
was last focused or clicked. The one registered save writes both works and
reports one outcome. A bibliography save writes new, edited and moved rows and
deletes removed ones in one call. Sorts are placed per run the readers sort,
the headings and each heading's entries, keeping as many stored sorts as fit
and writing the fewest rows for their sort alone. A row with no text is held
back, and so are the rows under a new heading until it has a name; the save
then reports a failure, and those rows count as unsaved. When a save's
outcome is unknown the rows are read back. When the passages' outcome is
unknown, unsaved rows count among the changes a reload would discard. When
the rows cannot be read, the tab falls back to the read-only list.
