# Titles and work metadata

The slots a work's titles occupy, and the work-level fields an import may set.
Source-agnostic: where a reader finds these is its own business.

## Title slots

A slot is a **type plus a language**, and `upsert_title` addresses one slot. A
second title for a slot that already exists replaces it rather than adding to
it, so a source carrying two candidates for the same slot needs a decision, not
two operations.

| type | languages in use |
|---|---|
| `mainTitle` | `bo`, `Bo-Ltn`, `en`, `Sa-Ltn` |
| `longTitle` | `bo`, `Bo-Ltn`, `en`, `Sa-Ltn`, `zh` |
| `otherTitle` | any of the above |

`bo` is Tibetan script, `Bo-Ltn` Tibetan in Wylie transliteration, `Sa-Ltn`
Sanskrit in transliteration, `zh` Chinese.

A missing title is a missing slot: emit nothing for it rather than an empty
string or a guess. Titles a source does not classify go to `otherTitle`.

Titles may already exist on the work before an import — it is common for them to
be created ahead of the content. The imported document is authoritative: each
existing slot is updated to the document's content, and unmatched slots are
inserted.

## Work fields

- `works.toh` — the Tohoku catalog number, as `toh44`, via `update_work`.
- `works.restriction` — `true` for a text carrying a tantra restriction, via
  `update_work`.

## Folio metadata

`folio_annotations.source_description` records the source the translation was
made from, set with `upsert_folio_annotation`. A work with no folio annotation
row yet returns a warning rather than failing the import.
