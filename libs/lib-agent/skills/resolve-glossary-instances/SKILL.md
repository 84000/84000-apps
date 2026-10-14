---
name: resolve-glossary-instances
description: Find where a work's glossary terms occur in its passages and add the glossary-instance annotations, with every match reviewed before it is written. Use when an editor wants a work's glossary linked to its text, typically a newly imported work with no instances, or a finished work whose glossary has grown. Plans server-side, reports to the editor, records review decisions that persist across runs, and applies what was accepted in safe, resumable chunks.
---

# Resolve glossary instances

A glossary instance is an annotation on a span of a passage that cites a
glossary term. This skill proposes every place the work's terms occur, has each
proposal judged, and writes the accepted ones. Matching is the easy part; the
skill exists for the judging.

Read `reference/review.md` before step 3. It says where the rules stop and
judgment begins, what each review tier means, and how decisions and the audit
work.

## The tools

| tool | what it does |
|---|---|
| `plan-glossary-instances` | Re-reads the draft, matches every term, applies every recorded decision, and reports. Never writes passages. |
| `record-glossary-review` | Records decisions: rules, single-candidate decisions with overrides, and missed instances. Never writes passages. |
| `apply-glossary-instances` | Writes the accepted, audited instances. |

The server does the matching and the writing. You never send offsets: candidates
have stable `key`s, and a span is named by its text. Passages and terms are
cited by the work snapshot's anchors (`p-…`, `g-…`), so where the snapshot tools
(`work-ls`, `work-read`, `work-grep`) are available you can read any candidate's
surroundings or a term's glossary entry in `glossary.md` without guessing.

Every plan is fresh and every decision persists, so a session can stop at any
point and the next one picks up exactly where it left off. Nothing needs
redoing.

## Workflow

### 1. Resolve the work

Run `resolve-toh` and keep the work's `uuid`; every tool takes `workUuid`.

### 2. Plan and report (before anything is written)

Call `plan-glossary-instances` with the default `view: "summary"`. Report to
the editor:

- how many candidates there are, by tier (`auto`, `term`, `instance`);
- what the house rules excluded, by reason. Excluded matches are reported,
  never dropped, and an instance decision can still accept one;
- how many instances already exist (`applied`);
- anything already decided in an earlier session, and any orphans or
  conflicts.

Then page `view: "terms"` (most open work first) and show the editor the terms
that need them: homographs, ordinary English words, alternatives, and the
low-confidence list from step 4. A fresh work with no instances is the usual
case. Its tiers come from the matches themselves, so it is planned like any
other work. Coverage, when there is any, only orders the list.

Ask the editor how they want to judge this run (see `reference/review.md`):
model then editor (the default), editor only, or model only with a sampled
audit. Record each decision with the right `decider`.

### 3. The auto tier

Show the editor the auto-tier counts and a few examples per term, from
`view: "candidates", tiers: ["auto"]`. If they accept the tier, record one rule
with `decider: "editor"`:

```json
{ "rules": [{ "tier": "auto", "verdict": "accept" }] }
```

Any term they want looked at more closely gets a more specific rule (a `review`
or `skip` rule for that term), which outranks the tier rule.

### 4. The term tier

For each term in this tier, read its candidates and decide one rule per term or
form, with a context rule where the sense depends on the neighbouring words. For
example, skip `lord` followed by `of death`. Give a one-line reason. Record your
rules as `decider: "model"`.

Show the editor each rule with its examples and counter-examples. Record the ones
they confirm or change as `decider: "editor"`. An editor's rule outranks yours.

### 5. The instance tier

Judge each candidate, batched by term, so you read each term's definition once.
Record `{ key, verdict, confidence, reason }` as `decider: "model"`, and use an
override where it is right:

- `termUuid`: a homograph meaning the other term;
- `span`: the instance is a longer or shorter phrase, named by its text;
- `additions`: an instance the plan missed, by passage, text and occurrence.

Records are cheap. Send hundreds of decisions per call. For a very large work,
split the terms across sub-agents, each recording its own batches: batches never
overwrite each other.

Show the editor every decision below 0.8 confidence.

### 6. The audit

The model's decisions on a term apply only once an editor has checked a sample
of them: 20 per term by default. Page `view: "samples"` and show the editor each
sample candidate with your verdict. Record their verdicts as
`decider: "editor"`. If more than one disagrees with yours, the term is sent
back (`needs-editor`). Show the editor the rest of that term's decisions; your
decisions on it are not applied until they decide. To change the sample size
or the error allowance for the work, record `settings` as `decider: "editor"`,
only on the editor's say-so.

### 7. Apply, then re-plan

Call `apply-glossary-instances` with `dryRun: true` and show the editor the
counts: what will be written, and what is held (`awaiting-sample`,
`needs-editor`, `conflict`). Each chunk re-reads its passages before writing:
`stale` counts items whose text changed since the plan, `skipped` those that
now overlap a stored instance, and `alreadyApplied` those already stored. Apply once they confirm. Scope it with `termUuids`,
`tiers` or `keys` to apply part of the review and continue with the rest.

- `remaining` above 0: the time budget ran out. Call again.
- `stopped: "unknown"`: a chunk may have been written. Re-plan before anything
  else, and never retry blindly. Stored instances show up as `applied`, so a
  re-plan is always safe.
- `undo.path`: the uuids written, the handle for undoing this apply. If the
  file could not be stored, `undo.annotationUuids` lists them all; give them to
  the editor.

Re-plan, and repeat from step 2 on what is left until nothing is undecided or
the editor is done.

### 8. Verify

Re-plan and check that:

- `applied` grew by the number written;
- nothing is left in `conflict`;
- every orphan is explained. An orphan is a decision whose text has changed
  since it was made.
