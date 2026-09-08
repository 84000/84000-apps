# Sections and passages

Which paragraphs become passages, and which section they belong to. The types
and labels that follow from that are in `import-model/passages.md`.

## The base rule

After `Canonical Reference:`, every supported paragraph becomes one
`upsert_passage`, in source order, with the normalized paragraph text as its
content — unless a merge rule below applies.

A hard return usually starts a new passage. A soft return never does on its own;
inside verse it becomes a `line` annotation instead.

## Section headers

A `Heading 1` becomes a header passage for the section it opens. Match the
heading text to a section family by meaning, not by string equality — the family
name, its header type, its body type and its fixed label are all in
`import-model/passages.md`, along with the `heading` annotation every header
carries.

A heading text with no obvious family is still probably one of the known
sections. Choose the closest, and say so in the preview.

## Nested headings

`Heading 2` and deeper become passages of the active section's **header type**,
labelled by outline position, carrying a `heading` annotation whose `level` is
the real depth.

Word supports `Heading 1` through `Heading 9`. Some editors type tags such as
`<level 10 div>` instead; treat those as deeper nested headings in the active
section rather than as content.

## The translation body title

Where the translation section opens with an honorific line followed by the main
title line, merge the two paragraphs into one passage and annotate each range —
see `import-model/passages.md`. Where only one of the two is present, emit it as
an ordinary titled passage and note the absence.

## Endnotes

Each note paragraph becomes one passage of type `endnotes`. The section takes a
header passage like any other.

Note references inside the body are ordinary text at this stage; there is no
importable annotation binding a reference to its note.

## Abbreviations

Each paragraph becomes one passage of type `abbreviations`. Entries are usually
tab-separated, as `C{tab}Chone Kangyur`.

There is **no importable abbreviation annotation**, so the tab-separated
structure does not survive as markup — the text does, the pairing does not.
Import the text and say so in the preview.

## Skipped sections

`Bibliography` and `Glossary` produce nothing. Detect the `Heading 1`, skip to
the next supported `Heading 1` or the end of the document, and consume no label
numbers on the way.
