# Selectors that work

From `apps/web-main-e2e/src/support/editor.ts`; read that file when one of
these stops matching. Every passage renders more than once (a hidden mobile
layout and force-mounted inactive tabs), so always take the `:visible` copy.

| What                        | Selector                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A passage row               | `[data-stack-passage="<uuid>"]:visible`                                                                                           |
| Its editable text           | `<row> .ProseMirror[contenteditable="true"]`                                                                                      |
| Its label                   | `<row> [data-passage-label][data-uuid="<uuid>"]`                                                                                  |
| A panel tab                 | `getByRole('tab', { name: 'Front' \| 'Translation' \| 'Compare' \| 'Notes' \| 'Abbr' \| ... , exact: true })` filtered to visible |
| Save button                 | the visible button named "Save" outside dialogs                                                                                   |
| Toasts                      | `[data-sonner-toast]`                                                                                                             |
| Label menu                  | click the label, then `getByRole('menu')` / `getByRole('menuitem', { name })`                                                     |
| Slash menu entries          | `div.bg-popover.w-72 p.font-medium`                                                                                               |
| Bubble menu                 | `[data-slot="scroll-area"]:visible` that contains `svg.lucide-list-indent-increase`                                               |
| Node selector               | the bubble menu's first `button`; entries are `[role=dialog] div.cursor-pointer`                                                  |
| Glossary instance           | `[type="glossaryInstance"]`                                                                                                       |
| End-note link               | `[type="endNoteLink"]`                                                                                                            |
| Mention                     | `[type="mention"]`                                                                                                                |
| Comment anchor              | `span[type="comment"][comment="<uuid>"]`                                                                                          |
| Back-reference under a note | `a[data-passage-reference][data-ref-uuid]`                                                                                        |
| Save request                | `POST **/rest/v1/rpc/apply_passage_save`                                                                                          |

Tips:

- Clicking a passage on a content link follows the link. To place the caret,
  click a character outside links (see `caretAtEnd` in `editor.ts`), then
  move the selection with the DOM Selection API.
- Rows are virtualised: scroll a row into view (`scrollIntoViewIfNeeded`) and
  wait for its box to stop moving before you act on it.
- After Save, wait for the save response and for the Save button to go
  before you query the database, then reload before you read the screen.
- Find a passage's uuid by label with
  `sql.sh "select uuid from passages where work_uuid = 'f09e7249-07a1-496e-8662-665e80f5461c' and label = '1.12'"`,
  or with the seed formula in the spec README.
