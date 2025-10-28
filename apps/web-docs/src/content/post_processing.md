# Post-migration Processing Steps

After migrating a text from TEI to Supabase, there are several post-processing
steps that need to be performed to ensure the data is displayed correctly. This
document outlines those steps.

## Steps

1. Change all passages with type `end-note` to `endnotes` to maintain consistency.
   It is Okay to run this query against the entire tables since `end-note` is
   not supported. It becomes plural to match other types and the `endnotesHeader`
   passage type.
1. Mark annotations with type `quote`, `quoted`, and `reference` as deprecated
   by changing their type to `deprecated-quote`, `deprecated-quoted`, and
   `deprecated-reference` respectively. We will need to handle these types
   differently in the future.
1. For `internal-link` annotations, rename the type of rows where the `content`
   column, a jsonb array, contains and object with a `link-text` key or the
   `start` column equals the `end` column to `deprecated-internal-link`.
1. For `internal-link` annotations, find corresponding passages uuids for the
   `href` in the `content` jsonb array and update the `content` to
   append an object with the `uuid`. The `href` contains a fragment identifier
   (e.g., `#passage1`), so we need to extract the part after the `#` to match with
   the `xmlId` of the passages.
1. Similarly, for `internal-link` annotations that end with a tohoku number (and
   possibly `.html`), find corresponding work uuids for the `href` in the
   `content` jsonb array and update the `content` to append an object with the
   `uuid`.
1. For `end-note-link` annotations, find corresponding passages uuids for the
   `endnote_xmlId` in the `content` jsonb array and update the `content` to
   append an object with the `uuid`.
1. Decrement the `start` and `end` columns by 1 for all annotations for the work,
   excluding the deprecated types and `glossary-instance` types.
1. Inspect the results. These steps may not fix everything. Annotations that can
   be nested (such as line and list-item annotation) are especially prone to
   "drift", meaning their start and end values no longer apply to the correct
   content. These must be corrected individually.

The above steps are encapsulated in stored transaction,
[available here](https://supabase.com/dashboard/project/ivwvvjgudwqwjbclvfjy/sql/c2dac5f2-d710-4dc2-a6a3-71cb95e24165)
(Supabase access required).
