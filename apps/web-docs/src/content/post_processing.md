# Post-migration Processing Steps

After migrating a text from TEI to Supabase, there are several post-processing
steps that need to be performed to ensure the data is displayed correctly. This
document outlines those steps.

## Passages

1. Change all passages with type `end-note` to `endnotes` to maintain consistency.
   It is Okay to run this query against the entire tables since `end-note` is
   not supported. It becomes plural to match other types and the `endnotesHeader`
   passage type.

   ```sql
   UPDATE passages
   SET type = 'endnotes'
   WHERE type = 'end-note';
   ```
