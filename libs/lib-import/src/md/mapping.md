This directory contains the `.docx` to database mapping spec for `lib-import`.

Agents should not treat this file as the full spec. Use it as the entrypoint for staged lookup.

# Read Order

1. Read [mapping-overview.md](./mapping-overview.md) first.
2. Classify the current input as metadata, passage structure, or formatting.
3. Read exactly one specialized file for the local rule:
   - [mapping-metadata.md](./mapping-metadata.md)
   - [mapping-passages.md](./mapping-passages.md)
   - [mapping-formatting.md](./mapping-formatting.md)
4. Use [mapping-examples.md](./mapping-examples.md) only to validate interpretation. It is non-normative.

# File Responsibilities

- `mapping-overview.md`
  Canonical source for processing order, section state, label generation, precedence, fallback behavior, and unsupported sections.
- `mapping-metadata.md`
  Cover sheet, title page, and `Canonical Reference:` rules.
- `mapping-passages.md`
  Passage creation, heading behavior, section rules, merged passages, and deferred sections.
- `mapping-formatting.md`
  Paragraph styles, lists, tables, and inline annotations. This file adds annotations to passages defined elsewhere.
- `mapping-examples.md`
  Worked examples only. It must not define behavior that is absent from the normative files.

# Conflict Resolution

If two files appear to conflict, `mapping-overview.md` wins unless it explicitly delegates that behavior to a specialized file.
