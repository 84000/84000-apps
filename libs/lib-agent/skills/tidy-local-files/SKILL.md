---
name: tidy-local-files
description: List the files the 84000 skills have left on the user's computer, with their sizes, and remove the ones the user agrees to — superseded or old downloads, and scratch files whose results are saved. Use when the user asks to tidy, clean up or free space from their 84000 files, asks what the 84000 folder holds or how big it is, wants old work snapshots or eText downloads deleted, or when another 84000 skill has said the download cache is large. Lists and asks before deleting anything, and never removes a deliverable that is not saved in the studio.
---

# Tidy local 84000 files

The 84000 skills write under one root folder, split by how long a file should
live. `reference/local-files/layout.md` is the convention: read it first. This
skill reports what is there and removes what the user agrees to.

**Nothing is deleted or moved until the user has seen the list and confirmed
it.** A file you are unsure about stays.

This needs a shell. Without one, say so and stop.

## 1. Find the root

The root is the location the user has named for 84000 files, if they have
named one, and otherwise `84000/` in the working folder. Resolve it to an
absolute path (`cd <root> && pwd -P`) and use that path from here on.

Also look in the working folder itself for files from before the convention
(see _Files from before this convention_ in the layout): `toh*_stage*`,
`toh*_copyedit*`, `toh*_glossary-instances.md`, `etexts-*/`, `toh*-draft.tar.gz`
and a snapshot tree (a `toh*/` folder holding `manifest.json` and `text/`).

If there is no root and nothing from before, say there is nothing to tidy.

## 2. Take the inventory

Measure each entry with `du -sk`, and list:

| Where                                          | One entry per                                     |
| ---------------------------------------------- | ------------------------------------------------- |
| `cache/work/<toh>/`                            | snapshot folder (`<generated>`)                   |
| `cache/etexts/`                                | build folder (`<build id>`), with its collections |
| `cache/bundles/`                               | bundle folder (`snapshot-<12 hex>`)               |
| `cache/bin/<tool>/`                            | version folder                                    |
| `scratch/`                                     | task folder                                       |
| `deliverables/<toh>/`                          | file                                              |
| the working folder, from before the convention | file or folder                                    |

Anything else under the root is not recognised: list it as such and leave it
alone.

## 3. Decide what to propose

**Cache.** Everything in the cache can be downloaded again, so it is the first
place to reclaim space. Propose removing:

- a **superseded** entry: every snapshot of a work but its newest, every eText
  build but the newest (both keys sort by time), and a bundle whose
  `manifest.json` lists the same layers and options as a newer bundle, and
  every version of a tool but the one most recently put in place;
- an entry **older than 30 days** by its key, or by `createdAt` in a bundle's
  `manifest.json`. Use another age if the user gives one.

The newest, recent entries are kept unless the user asks for them to go too.

**Scratch.** Call `read-session-documents` with the work's Toh (the first Toh
of a two-Toh prefix) to list what is saved for it. Propose removing a task
folder whose work has the results of that stage saved. Where nothing is saved
for that stage, or the call fails, list the folder as **results not saved** and
recommend keeping it unless the user says the task is finished or abandoned.

**Deliverables.** Never proposed. They are the user's working copies, and the
user may have revised one since it was saved. Remove one only when the user
asks for it by name, and only when every test below passes:

1. `read-session-documents` lists a document of the same filename for the work.
   A failed read is not an absent document, but either way the file is not
   shown saved: keep it.
2. The local file is the same as the saved copy. Read the saved copy: markdown
   and JSON come back as text, so compare them exactly; a `.docx` comes back as
   a signed URL, so fetch it into `scratch/tidy/` and compare the two with
   `shasum -a 256` (or `sha256sum`), then delete the fetched copy. The URL is a credential: do
   not log it or write it to a file.
3. The user confirms that deliverable, named, after seeing that it is saved and
   unchanged.

If the local file differs from the saved copy, it holds work that storage does
not: say so and keep it. Offer to save it first with the stage's skill if the
user wants it gone.

**From before the convention.** Offer to move these into place rather than
delete them: a deliverable to `deliverables/<toh>/`, an `etexts-<build id>/` to
`cache/etexts/<build id>/`, and a snapshot tree to
`cache/work/<toh>/<generated>/` (the time from its `manifest.json`
`generatedAt`). A leftover `.tar.gz` whose tree is unpacked beside it can be
removed. Moving is a change to the user's folder too, so it is confirmed like a
removal.

## 4. Show the list and ask

Show one table, grouped by action, every row with its path relative to the
root, its size, and the reason:

| Action | Path | Size | Why |
| ------ | ---- | ---- | --- |

Then the totals: space each group would free, and what stays. Ask the user to
confirm all of it, some of it, or none. Removing scratch whose results are not
saved, a recent cache entry, or a deliverable needs the user to name it, not
just accept the list.

## 5. Remove what was confirmed

Remove only the confirmed paths, one at a time, each given in full
(`rm -rf -- '<absolute path>'`):

- every path must resolve under the root (`realpath` it and compare the
  prefix), or for a file from before the convention, be the exact path you
  listed in the working folder;
- never a wildcard, never the root itself, and never follow a symbolic link out
  of the root;
- a path that has changed since you listed it (a new file in a scratch folder,
  a deliverable edited since) is skipped and reported.

Then report what was removed or moved, the space freed, and what was kept and
why.
