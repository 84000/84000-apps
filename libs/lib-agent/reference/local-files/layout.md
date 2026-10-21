# Where 84000 skills write local files

Every file an 84000 skill writes to the user's computer goes under one root
folder, split by how long the file should live. This is so the user can find
their work, a later session can reuse a large download instead of fetching it
again, and the `tidy-local-files` skill can tell what is safe to remove.

This file is the mechanism, and it is the same for every skill. Which files a
skill writes, and what they are named, is in that skill and its policies.

## The root

The root is `84000/` in the working folder: the folder the session runs in,
which in Cowork is the folder the user chose. Create it, and any folder below
it, when you first need it.

If the user has named a different location for 84000 files, in this
conversation or in their own standing instructions, use that as the root
instead and keep the same folders under it. Do not go looking for one
elsewhere, and do not move files that are already there unless asked. Skills
write paths as `84000/…`: read that as the root, wherever it is.

Leave nothing of 84000's outside the root. A file the user supplied stays where
it is (read it in place), and the user may ask for a copy somewhere else.

## The folders

| Folder                  | Holds                                                     | Lifetime                                    |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------- |
| `deliverables/<toh>/`   | A stage's deliverables and any report the user keeps      | Kept. These are the user's working copies   |
| `cache/`                | Downloads: work snapshots, eText archives, bundles, tools | Reusable while current; removable any time  |
| `scratch/<toh>/<task>/` | Intermediates: chapter findings, script inputs and output | Removable once the task's results are saved |

`<toh>` is the prefix the work's filenames use: `toh345`, or `toh773-969` for
a text with two Toh numbers. For a task that is not about one work, use
`scratch/<task>/`.

### Deliverables

The files a stage's policies name, written under their plain names:
`84000/deliverables/toh345/toh345_stage2.docx`. The name is what is saved to
storage, never the path.

The user opens and revises these, so a local deliverable may be newer than the
copy in storage. Never delete, move or overwrite one without asking. Writing
the same stage again for the same work replaces the file: say so first, as the
stage's policies ask for a re-run.

### Cache

A download goes into a folder named for exactly what it holds, so a stale copy
can be told from a current one, and a current one reused:

| Download                                  | Folder                          | Key                                                                                            |
| ----------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| A work's draft snapshot (`dataset: work`) | `cache/work/<toh>/<generated>/` | The snapshot's `generated` time from its freshness line, as `YYYYMMDDTHHMMZ`: `20261013T1000Z` |
| The eText catalog and collection texts    | `cache/etexts/<build id>/`      | The build id the tool's first line names                                                       |
| A bundle of layers                        | `cache/bundles/`                | None of your own: the bundle unpacks into its own `snapshot-<12 hex>/` folder, which names it  |
| A command-line tool a skill ships         | `cache/bin/<tool>/<version>/`   | The tool's version, as the skill names it                                                      |

The folder must be new and empty when you unpack into it, so run the fetch
command the tool returns from inside it. For a work snapshot that gives
`84000/cache/work/toh8/20261013T1000Z/toh8/`; for the eTexts,
`84000/cache/etexts/<build id>/etexts/`, with the catalog and every collection
of one build unpacked side by side. Delete the `.tar.gz` once it has unpacked.

**Reuse.** Call `download-snapshot` first anyway: it is how you learn the
current snapshot or build. If its key matches a folder that already exists
and holds the unpacked tree, use that folder and do not fetch. A work snapshot
that is not `current` is handled as the skill says; when a current one comes,
it gets a new folder.

Never write into a cache folder: it is the server's data as downloaded. Put
anything you derive from it in `scratch/`.

**Tools.** A skill that downloads a program on first use, rather than shipping
it as a script, keeps it under `cache/bin/<tool>/<version>/`, one folder per
version, with any per-platform detail inside it as that skill says. Fetch it
only from where the skill says, check it against the checksum the skill gives
before running it the first time, and reuse it while the skill names the same
version. An older version folder is superseded once a newer one is in place.

### Scratch

Everything a task produces on the way to its results: chapter findings before
they are merged, the files a script reads or writes, a run's working data.
One folder per task, named for it (`scratch/toh345/stage2-chapters/`,
`scratch/toh8/glossary-instances/`). A task that runs more than once in a
session numbers its runs (`run1/`, `run2/`).

Some scratch files are also saved to storage, as chapter findings are; save
them from where they are. Scratch is safe to remove once the task's results
are in storage or delivered, but not before.

## After a download

The eText collections run to hundreds of megabytes each. After a download,
check the size of `cache/` (`du -sh 84000/cache`). If it is over 2 GB, tell
the user once in the session, and say that the `tidy-local-files` skill can
list what is safe to remove. Do not remove anything yourself.

## Files from before this convention

Earlier sessions wrote to the working folder itself: `toh345_stage0.md` and its
siblings, `etexts-<build id>/`, a snapshot tree such as `toh8/` with its
`toh8-draft.tar.gz`. Leave them where they are. Write new files under the root,
and mention the old ones only if they get in the way; `tidy-local-files` can
move or remove them with the user.
