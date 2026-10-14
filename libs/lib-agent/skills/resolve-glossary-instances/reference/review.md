# Reviewing glossary candidates

## Where the rules stop and judgment begins

The rules decide **where a match is**. They never decide **whether it is the
term**.

| the rules decide | judgment decides |
|---|---|
| a form matches on word boundaries, a soft hyphen or line break inside it included | whether the word is used in the glossary's sense here |
| a plural (`-s`, `-es`) is inside the instance; a possessive (`’s`) is outside | which of two terms a homograph means |
| a leading "the" in a glossary name is not required | whether a longer or shorter phrase is the real instance |
| each side of a hyphenated compound can match, and is flagged | whether a part of a compound counts |
| when matches overlap, the longest wins and the rest are reported | whether to accept a match the rules set aside |
| matches inside inline titles, foreign spans or mantras, in headers and back matter, or on a title line, are excluded with a reason | |
| an existing instance is never duplicated | |

Nothing is dropped because a term is rare, new to the work, or has no
instances yet. Recall comes first. A candidate the rules have no objection to
is proposed, however unlikely, and review removes it.

## Tiers

Every candidate gets a tier from the match itself, never from the work's
existing instances.

- **auto**: the term's own English, not an ordinary lowercase word, and not
  shared with another term. Almost always right; reviewed by sample.
- **term**: one decision covers the term or form. Ordinary words, where the
  glossary sense is a choice (`lord`, `emptiness`), alternatives, and
  lowercase names written in title case.
- **instance**: each occurrence needs a look. Homographs (a form shared by
  terms) and unexpected casing.

## Decisions

There are three grains.

1. **Rules** cover a tier, a term or one of its forms, and can be limited to a
   context (`precededBy`, `followedBy`, matched on whole words). The most
   specific rule wins. Rules decide only proposed candidates, never excluded
   ones. A term or form rule never covers the instance tier unless it says
   `tier: "instance"`: those candidates are judged one by one.
2. **Instance decisions** cover one candidate, or one added instance, by
   `key`. They can override the term (`termUuid`) or the span (`span`, given as
   text, at or beside the candidate). Only an instance decision can accept an
   excluded candidate.
3. **Additions** are instances the plan missed, named by passage, text and
   occurrence.

An editor's decision outranks the model's at every grain. For each of them, an
instance decision outranks an addition or a rule, and a later decision
supersedes an earlier one on the same candidate.

Decisions are stored per work and kept forever. Each call adds one batch; no
call ever changes or removes an earlier one. On every plan:

- decided candidates come back decided;
- applied ones show as `applied`;
- only new or changed text comes back undecided.

A decision whose candidate's text has since changed is an **orphan**. It is
reported and never applied.

Candidate keys come from the passage, the matched text and the text just around
it. They survive edits elsewhere in the work and elsewhere in the passage, but
an edit right beside a candidate gives it a new key, and its old decision
becomes an orphan. Re-decide it. Occurrences with the same text around them
are told apart by their order, so deleting one can pass its decision to the
next; their contexts are identical, so the decision fits. An addition records
the text around it the same way, and its key (returned as `additionKeys`)
includes its term.

An accepted item whose span already holds a stored instance of the same term
shows as `applied`. One that overlaps any other stored instance, or another
accepted item, is a `conflict` and is not applied.

## The audit

The model's decisions on a term apply only after an editor has checked a
sample of them. The sample is drawn per term from the candidates the model
decided, in a fixed order, so a re-plan shows the same sample.

| setting | default | meaning |
|---|---|---|
| `sampleSize` | 20 | candidates per term an editor checks; 0 turns the audit off |
| `maxSampleErrors` | 1 | editor verdicts that may disagree with the model before the term is sent back |

An editor changes them for the work with `settings` on
`record-glossary-review` (`decider: "editor"`); the latest setting wins.

An error is an editor's instance decision that disagrees with the model's
decision on the same candidate: a different verdict, or a different term or
span. Disagreements outside the sample count too. The model's additions are
audited with its other decisions on their term.

| state | meaning |
|---|---|
| `awaiting-sample` | the model decided, and the term's sample is not yet fully checked |
| `needs-editor` | the term was sent back; the model's decisions on it, skips included, wait for an editor |
| `accepted` | an editor decided it, or the model did and the term's audit passed |

## Who judges

- **Model then editor** (default): the model decides, and the editor confirms
  rules and checks samples.
- **Editor only**: record everything as `decider: "editor"`; nothing is
  audited.
- **Model only, audited**: the model decides, and an editor still checks the
  samples before anything applies.

The record shows who decided each candidate, so a later reader can tell.

## Scale

On a large work, never page every candidate through the conversation:

- **group:** one rule settles a term;
- **sample:** the audit checks a fixed number per term, however many it has;
- **triage:** spend per-instance attention only on the instance tier.

For a shell-side look at everything, `download: true` on the plan returns a
signed URL to a TSV of every candidate.
