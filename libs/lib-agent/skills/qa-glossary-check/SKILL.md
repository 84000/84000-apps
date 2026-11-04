---
name: qa-glossary-check
disable-model-invocation: true
description: Final QA check of a work's glossary at the end of the digital publication process. Use when an editor asks to run the glossary QA, check or QA a work's glossary before publication, or find glossary entries whose definitions will show up empty. Flags entries that defer to a standard definition that does not exist yet, proposes a definition for each from other works' published entries for the same term, fitted to how this work uses it, and writes only the definitions the editor approves.
---

# QA glossary check

A late-stage check of one work's glossary, run by the editor once the work is
otherwise ready to publish. Each check finds a class of problem with code, then
you do the part that needs judgement and propose a fix. Nothing is written
until the editor has seen the proposal for that entry and approved it.

The finding is always mechanical and the fix never is. Do not let a tool's
result stand in for reading the candidates and the text.

## Before you start

1. **Resolve the work.** Run `resolve-toh` on the Tohoku number the editor gives
   you and carry the work UUID forward. Every tool below takes the UUID.
2. **Read the glossary policy.** Call `read-policies` with
   `["translator-guidelines/V.H-glossaries"]`. Policies change without a
   release, so read it now rather than relying on this file. It sets how a
   definition is written (see *Writing the definition* below), and it says that
   when no standard definition exists, a definition may be taken from a
   published text already in the Cumulative Glossary. That is the fix check 1
   proposes.

## Check 1: placeholders behind a missing standard definition

### What it finds

A glossary entry whose `definition_rend` is `overrideWithStandard` shows its
authority's standard definition (`authorities.definition`) instead of its own.
Translators mark such entries by writing "use standard" (or "use 84000 standard
definition") as the entry's own definition. This text stays hidden on the live
site.

That is fine while the authority has a standard definition. When it has none,
the reader shows the entry with **an empty definition**. The fix is to give the
entry a definition of its own and set its `definition_rend` to
`incompatibleWithStandard`, so that its own definition is shown and the missing
standard is ignored. The other `…WithStandard` settings combine with the
standard and would still show nothing.

### 1. Find the flags

Call `qa-glossary-standard-definitions` with the work UUID. It returns:

- `placeholders`: entries set to `overrideWithStandard` whose own definition is
  a "use standard" placeholder;
- `covered`: how many of those have a standard definition. These are fine and
  need nothing;
- `gaps`: the rest. Each has its `glossaryUuid`, `authorityUuid`, the term's
  name (`term`), the authority's `headword`, and the hidden placeholder text
  (`definition`).

A gap with a null `headword` means the authority record is missing. Report it,
but do not try to fix it here: copying a definition will not repair a broken
authority link. The editor should raise it with the team.

If there are no gaps, report the totals and stop.

### 2. Find the definitions other works have published

Call `get-authority-glossary-entries` **once** with every gap's
`authorityUuid` (up to 50 per call) and `excludeWorkUuid` set to this work. The
lookup is exact: the authority is the term's shared identity, so every entry it
returns is the same term in another work, not a string that happens to match.
It returns only entries with a definition, each with the work's Toh number and
title.

- Different works often carry the **same definition**, copied from one another.
  Group identical texts and present them once, listing the works that use them.
- If an authority has no published candidate, call the tool again for those
  authorities with `source: "draft"`. That adds works in preparation. Say
  clearly that such a definition has not been through publication.
- If there is still nothing, there is nothing to copy. Say that there are no
  published candidates for this entry and move on. The editor may request to 
  draft a newly written definition from the text's context, but it is also fine
  to move on and leave this defintion blank. 

### 3. Read how this work uses the term

For each gap, call `get-glossary-term-contexts` with its `glossaryUuid` and
`source: "draft"`. Three to five passages are usually enough (`limit`). It
returns short excerpts of the passages that cite the term, with the term
marked «like this».

It returns nothing when the entry has no glossary-instance links: the entry is
a child name rather than the term, or the work's instances have not been
resolved yet. In that case search the draft for the term's name (`term` from
step 1) with `work-grep`, and read around a hit with `work-read`. If that is
not available, use `search-translation`, which reads the published text.

### 4. Propose a definition

For each gap, choose the candidate that best fits the sense found in step 3.
Then fit it to this work.

**Choosing.** Prefer a candidate that:

- describes the same referent in the same role. A personal or place name can
  share an authority across works while the entries describe different
  episodes; take the one that fits this text;
- is general enough for the Cumulative Glossary. Its first sentence should work
  as a brief definition on its own;
- comes from a published work over a draft one, and is more informative over
  less, other things being equal.

**Fitting it to this work.** A definition copied from another work often carries
that work's specifics. Remove or rewrite:

- the role a person or place plays *in that text* ("The main interlocutor of
  this sūtra", "A king who appears in chapter 3");
- "Also rendered here as…" or "Also translated here as…" about *that*
  translation's renderings;
- references to that work's notes, passages or folios, and links into it.

Add what this work needs, from step 3 only: the person's role here, a narrower
sense used in this text, or this work's own alternative rendering. Do not add
facts you cannot point to in a candidate or in this work's text.

**Keep the translator's own addition.** A placeholder sometimes carries
text-specific wording around the instruction: "use standard + Also rendered
here as 'bodhicitta.'", or "The main interlocutor of this text. + use
standard". That wording was meant to sit beside the standard definition. Keep it
in the new definition, in the same position: before the copied text when it came
before "use standard", after it when it came after.

### Writing the definition

Follow `translator-guidelines/V.H-glossaries` as read at the start. The points
that matter most here:

- capitalize the first word and end with a period, even for a fragment;
- informative but concise. The first sentence should stand alone as a brief
  definition, and the whole should be no more than about 150 words;
- a personal name says who they are and their role; a place name says what it
  is and why it features;
- keep inline formatting, such as italics for Sanskrit or Tibetan words, as the
  candidate has it.

### 5. Report and ask

Present the gaps one at a time, or as a numbered list the editor can work
through. For each:

| | |
|---|---|
| **Term** | `term` (and `headword`) |
| **Hidden placeholder** | the `definition` from step 1, verbatim |
| **How this work uses it** | one or two of the excerpts from step 3, and the sense you read in them |
| **Candidates** | each distinct definition, with the works that use it (Toh numbers) |
| **Proposed definition** | the full text you would write |
| **Changes from the source** | what you removed, rewrote or added, and why. Say "unchanged" if you took it verbatim |

Lead with the totals from step 1 (placeholders, covered, gaps), so the editor
can see the check ran. Say that nothing has been written yet.

The editor may approve a proposal, edit it, pick another candidate, or skip the
entry. Do not settle a choice for them, and treat an approval as covering only
the entry it was given for.

### 6. Write approved definitions

For each approved entry, call `update-glossary-definition` with:

- `workUuid` and `glossaryUuid`;
- `definition`: the text exactly as the editor approved it;
- `expectedDefinition`: the placeholder exactly as step 1 returned it. The write
  is refused if the entry has changed since;
- no `definitionRend`. The default, `incompatibleWithStandard`, is the one this
  fix needs.

Call it with `dryRun: true` first and show the editor the before and after: the
old placeholder and `overrideWithStandard`, the new definition and
`incompatibleWithStandard`. Then call it again without `dryRun` once they
confirm. Write one entry per call.

If a write is refused because the definition has changed, do not retry it with
the new value. Re-run step 1 and show the editor what is there now.

### 7. Verify

Re-run `qa-glossary-standard-definitions`. Entries you fixed no longer appear,
because their `definition_rend` has changed. The entries the editor skipped
should still be listed, and `placeholders` should have dropped by the number
written.

The new definitions reach the reader when the work is next published. Until
then, the draft glossary listing (`list-glossary-terms` with `source: "draft"`)
can still show the old text, because it is refreshed at publication.

## Limits

- Check 1 finds placeholders worded "use standard" or "use 84000 standard…",
  in any case. A placeholder worded differently is not found.
- It looks only at `overrideWithStandard`. An entry set to
  `appendWithStandard`, `prependWithStandard` or `bothWithStandard` whose
  authority has no standard definition also shows nothing on the reader, and is
  not yet checked.
- The fix gives one work's entry a definition. The lasting fix is a standard
  definition on the authority, which would serve every work. If the same
  authority comes up again and again, suggest the editor propose one to the
  team.
