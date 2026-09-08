# Reading the document

How a 84000 copy-editor `.docx` signals structure. What those signals *become*
is in `import-model/` — this file only gets you to the point where those rules
apply.

Read this file first, then the one that matches what is in front of you:
metadata before the body → `docx-metadata.md`; sections and passages →
`docx-sections.md`; styles and inline formatting → `docx-styles.md`. Use
`examples.md` to check your reading; it is non-normative.

Where this file and a specialized one disagree, this file wins unless it hands
that decision over explicitly.

## Guidance, not a rulebook

The template is loosely enforced, revised often, and the backlog spans years.
Real files deviate: reworded headings, missing or extra title lines, styles
applied inconsistently, content predating the current template.

Recognize a section by its **meaning**, not a literal string — "Translator's
Introduction" is the introduction. Map a deviation to the closest sensible
structure and note it in the preview. Ask when genuinely ambiguous. Never invent
content that is not in the source.

## Extraction

A `.docx` is a ZIP of OOXML. Extract text **with structure preserved**:
paragraph styles, heading levels, inline runs (bold, italic, underline, small
caps), and hyperlinks.

- If the file is attached to the conversation, read it directly.
- With a shell, `pandoc -t markdown file.docx` reads quickly, and
  `unzip -p file.docx word/document.xml` gives exact styles and runs.
- Preserve soft line breaks inside verse paragraphs. They drive `line`
  annotations and are lost by a naive text extraction.

## Vocabulary

- **paragraph** — a Word paragraph
- **hard return** (`¶`) — a paragraph break
- **soft return** (`⏎`) — a line break within a paragraph
- **adjacent paragraphs** — consecutive paragraphs with no paragraph of another
  style between them
- **section** — a top-level content area started by a `Heading 1`

## Processing order

1. Ignore the cover sheet.
2. Read the title page.
3. Read the `Canonical Reference:` section.
4. Enter passage generation.
5. Track the active section from `Heading 1`.
6. Track nested headings from `Heading 2` and deeper.
7. Emit operations in source order.
8. Skip unsupported sections.

## Active section

A `Heading 1` starts a top-level section, which stays active until the next
`Heading 1` or the end of the document. `Heading 2` and deeper create nested
headings inside it and inherit its family.

Unsupported sections are still detected, so the reader knows where supported
content resumes.

## Precedence

When several signals apply to the same content:

1. **Paragraph style** decides whether a passage is created and sets its type.
2. **Section context** sets section-specific labels and header types.
3. **Block, verse and mantra semantics** add annotations to that passage.
4. **Inline formatting** adds annotations and never changes the passage type.

## Fallback

- An unknown paragraph style is treated as `Normal`.
- Inline formatting with no mapping is ignored.
- An unsupported section is skipped whole, never partially ingested.
