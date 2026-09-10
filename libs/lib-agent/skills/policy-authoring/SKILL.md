---
name: policy-authoring
description: Write or revise an 84000 translation policy through the studio's write-policy tool — "add a policy for X", "update shared-policies/terminology", "excerpt Guidelines section IV.B into the policies", "this guidance is wrong, fix it". Covers where a policy goes, how it is named, which of the two content shapes it takes, and what cannot be undone once written. Use it whenever a policy is created or changed, including a small correction — the naming and header conventions are not guessable and a mistake is not reversible. Not for reading policies, which is read-policies on its own.
---

# Authoring and editing policies

84000's translation policies live in the private `translation-harness` storage
bucket, not in a repo, so an edit binds from the next session — for every
translator, without a release. That is the reason the conventions below matter
more than they would for a file in a codebase: there is no review step between
your write and someone else's next session.

Two studio tools reach them. `read-policies` lists and reads; `write-policy`
creates or replaces. There is nothing else — **no delete and no rename.**

## Always read before you write

1. `read-policies` with **no arguments** for the live listing of every name.
2. `read-policies` with the name you intend to change, to get its current text.

Both steps are load-bearing, for different reasons. The write replaces the whole
file rather than patching it, so you cannot revise a policy you have not read.
And the listing is your only defense against a typo: `translator-guideline/…`
instead of `translator-guidelines/…` does not fail, it silently creates a second
policy that nothing cites and no tool can remove. Match the prefix against the
listing character for character before writing.

## Naming

Every policy name is `<owner>/<leaf>`. The owner says who the guidance belongs
to, and there are three kinds:

| Owner | For | Example |
|---|---|---|
| `shared-policies` | Guidance used by more than one skill, or cited by other policies | `shared-policies/terminology` |
| A governing document | A section reproduced from one of 84000's authored guidelines documents | `translator-guidelines/IV.D-text-titles` |
| A skill name | Guidance belonging to exactly one skill | `first-draft-translation/register` |

These are conventions, not gates. A new `shared-policies` leaf, a new
`<skill-name>/` prefix, or a new governing document are all fine to establish
when the content calls for one — the thing to be careful about is spelling an
existing prefix correctly, not asking permission for a new one.

Under the two governing documents the leaf carries the document's **own** section
identifier followed by a slug — `IV.D-text-titles`, `II.vii-document-your-work-sanskrit`.
That is because those two documents number their sections independently, so the
identifier is only meaningful next to the document it came from. It describes how
those documents happen to be organized; it is not a shape to impose on a
`shared-policies` or skill-owned leaf, which are plain slugs.

## The two content shapes

A policy is either reproduced from a governing document or written here. The
distinction is visible in the first lines of the file and must not be blurred —
a reader needs to know whether they are looking at 84000's formal guidelines or
at workflow guidance, because only the former carries the authority of a
document they can consult in full.

### Verbatim excerpt from a governing document

Open with the provenance header, then the section under its own heading, then
the source's prose **unchanged** — do not tighten, modernize, or re-punctuate
it. Two documents are established, and their titles are exact:

```markdown
> Verbatim excerpt from **84000 Guidelines for Translators v. 10.31 (February 2026)**, section **IV.D**.
>
> The full document remains the authority. Only the sections the skills cite
> are reproduced, so a cross-reference below may point to a section that is
> not here — consult the full document for those.

## D. Text titles
```

```markdown
> Verbatim excerpt from **Text Critical Guidelines for 84000 Translators**, section **III.i**.
>
> The full document remains the authority. Only the sections the skills cite
> are reproduced, so a cross-reference below may point to a section that is
> not here — consult the full document for those.
>
> Heading anchors from the Google Docs export have been removed; the text is
> otherwise unchanged.

## i. Consult other versions
```

Note the differences, and carry them across rather than normalizing them: the
Translator Guidelines is cited with its version and date and the Text Critical
Guidelines without one, and only the latter adds the Google Docs line. The `##`
heading reproduces the source's own heading, which repeats just the last segment
of the section identifier (`IV.D` → `## D. Text titles`, `V.ii` →
`## ii. Consider the causes of variation`).

**Do not invent a title, version, or section number.** If you are working from
text the person pasted and cannot see the document's own title page or its
numbering, ask them for the exact strings. A wrong version in that header
asserts provenance that does not exist, and it is the one error a reader has no
way to catch.

### Guidance authored here

Open with this header, byte for byte — it is identical across every authored
policy, and its second line is what tells a reader the text is live:

```markdown
> 84000 workflow guidance, authored here rather than excerpted from a governing
> document. Read live from the studio: an edit binds from the next session.

# Marking uncertainty
```

Then an `#` title and the guidance in `##` sections. Where the guidance has
failure modes worth naming, close with a `## Not this` section of short
prohibitions — most authored policies have one, and it is where the mistakes
that actually recur get caught. Cite other policies by their full name in
backticks so the reference is resolvable: `` `translator-guidelines/II.C-terminology` ``.

## Get agreement before writing

Show the person the policy as it will read and get their explicit agreement
first. This is not a formality: the write is live for every translator's next
session, and the only record of what it replaced is the archive.

The write itself is a whole-file replacement — send the complete markdown, never
a fragment or a patch. The previous revision is copied into the bucket's
append-only `archive/` prefix automatically, and a failed archive abandons the
write, so a successful write always leaves the old text recoverable.

## Names are permanent

There is no delete and no rename, so a name is effectively an API: once written
it stays in the listing forever and anything may cite it. Choose it from the
listing, deliberately.

When a policy is genuinely superseded or misnamed, establish who cites the old
name **before** touching anything, because the two classes of citation are not
equally fixable. You can check the other policies exhaustively — `read-policies`
sees all of them. You cannot do the same for skills: they are distributed as
installed plugins, so a skill citing the policy may not be in this session at
all. Treat the skill side as unknown unless the person confirms it.

- **Another policy** cites it — fixable now. Policies are live, so rewrite the
  citing policy with `write-policy` in the same session.
- **A shipped skill** cites it — **stop and ask the person.** Skills are plugin
  content, immutable from a session: changing one takes a repo change and a
  plugin release. Completing the rename would leave a live skill pointing at a
  name that no longer carries the guidance, and you cannot repair it. Renaming
  is rarely worth that; say so and let them decide.

Once citations are accounted for, write the new policy and then overwrite the old
name with a pointer, so existing references resolve and read where to go:

```markdown
> Superseded by `shared-policies/term-selection`. Read that instead — this name
> is kept because there is no delete, and existing citations still resolve here.
```

Never leave a superseded policy holding its old guidance. Two live policies on
one subject is worse than either name being imperfect.
