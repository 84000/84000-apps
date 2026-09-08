# Worked examples

Input on the left, the operations it should produce on the right. Use these to
check your reading before you build a preview — if your output differs in shape
from these, the reading is wrong even when the text is right.

Non-normative. Where an example seems to conflict with `docx-structure.md`,
`docx-metadata.md`, `docx-sections.md`, `docx-styles.md`, or the
`import-model/` files, those win.

## 1. Title page and canonical reference

```text
List of Titles:
1. bcom ldan 'das
2. བཅོམ་ལྡན་འདས།
3. The Blessed One

Canonical Reference:
1. Toh 44
2. Degé Kangyur, vol. 3
3. ☒ Restricted
```

```json
[
  { "kind": "upsert_title", "title": { "content": "bcom ldan 'das", "type": "mainTitle", "language": "Bo-Ltn" } },
  { "kind": "upsert_title", "title": { "content": "བཅོམ་ལྡན་འདས།", "type": "mainTitle", "language": "bo" } },
  { "kind": "upsert_title", "title": { "content": "The Blessed One", "type": "mainTitle", "language": "en" } },
  { "kind": "update_work", "patch": { "toh": "toh44" } },
  { "kind": "upsert_folio_annotation", "patch": { "source_description": "Degé Kangyur, vol. 3" } },
  { "kind": "update_work", "patch": { "restriction": true } }
]
```

Three title lines, so three slots — lines 4 through 9 are absent and emit
nothing. The Sanskrit main title is not "line 4 shifted up".

## 2. Merged body title and nesting

```text
Heading 1: The Translation
Paragraph:  Homage to all buddhas and bodhisattvas.
Paragraph:  The Noble Sūtra of Example
Heading 2:  Chapter 1
Paragraph:  Thus have I heard.
```

```json
[
  { "kind": "upsert_passage",
    "passage": { "label": "", "type": "translationHeader", "content": "The Translation" },
    "annotations": [ { "kind": "heading", "start": 0, "end": 15, "data": { "level": 2, "class": "section-title" } } ] },
  { "kind": "upsert_passage",
    "passage": { "label": "1", "type": "translation",
                 "content": "Homage to all buddhas and bodhisattvas.\nThe Noble Sūtra of Example" },
    "annotations": [
      { "kind": "heading", "start": 0,  "end": 39, "data": { "level": 2, "class": "body-title-honorific" } },
      { "kind": "heading", "start": 40, "end": 66, "data": { "level": 2, "class": "body-title-main" } }
    ] },
  { "kind": "upsert_passage",
    "passage": { "label": "1.1", "type": "translationHeader", "content": "Chapter 1" },
    "annotations": [ { "kind": "heading", "start": 0, "end": 9, "data": { "level": 2, "class": "section-title" } } ] },
  { "kind": "upsert_passage",
    "passage": { "label": "1.1.1", "type": "translation", "content": "Thus have I heard." },
    "annotations": [] }
]
```

The two title paragraphs become **one** passage, and each heading annotation
bounds its own half of the merged content. The nested heading is
`translationHeader`, not a separate heading type.

## 3. Flat numbering outside the translation

```text
Heading 1: Summary
Paragraph:  This sūtra was taught at Rājagṛha.
Paragraph:  It concerns the perfection of wisdom.
```

```json
[
  { "kind": "upsert_passage",
    "passage": { "label": "s.", "type": "summaryHeader", "content": "Summary" },
    "annotations": [ { "kind": "heading", "start": 0, "end": 7, "data": { "level": 2, "class": "section-title" } } ] },
  { "kind": "upsert_passage", "passage": { "label": "1", "type": "summary", "content": "This sūtra was taught at Rājagṛha." }, "annotations": [] },
  { "kind": "upsert_passage", "passage": { "label": "2", "type": "summary", "content": "It concerns the perfection of wisdom." }, "annotations": [] }
]
```

The header takes the fixed label and stays outside the numbering tree, which
starts at `1` with the first body passage.

## 4. Block-verse with inline styling

One paragraph, style `Block-Verse`, with a soft return, and the first "emptiness" in italic:

```text
Form is emptiness,⏎emptiness is form.
```

```json
{ "kind": "upsert_passage",
  "passage": { "label": "1.1.2", "type": "translation", "content": "Form is emptiness,\nemptiness is form." },
  "annotations": [
    { "kind": "blockquote",  "start": 0,  "end": 37 },
    { "kind": "line-group",  "start": 0,  "end": 37 },
    { "kind": "line",        "start": 0,  "end": 18 },
    { "kind": "line",        "start": 19, "end": 37 },
    { "kind": "span",        "start": 8,  "end": 17, "data": { "textStyle": "emphasis" } }
  ] }
```

One passage, not two: the soft return produces `line` annotations, never a new
passage. Four annotations coexist because the source implies each independently.

## 5. A list, which does not survive

```text
Paragraph (bulleted): first witness
Paragraph (bulleted): second witness
```

```json
[
  { "kind": "upsert_passage", "passage": { "label": "3", "type": "introduction", "content": "first witness" }, "annotations": [] },
  { "kind": "upsert_passage", "passage": { "label": "4", "type": "introduction", "content": "second witness" }, "annotations": [] }
]
```

There is no importable `list` or `list-item`, so the bullets become ordinary
passages in reading order. Emitting `list` annotations would not fail — they
would be discarded in silence, which is worse. Say in the preview that the list
was flattened.
