# Saving a stage's documents to storage

Every stage of the pipeline saves its deliverables to the `translation-sessions`
bucket after writing them to local files. The local files are how the translator
works; the saved copies are where the stage's record lives, and they are what a
later stage reads. A stage that only wrote locally has left its record on one
machine.

This file is the mechanism, and it is the same for every stage. Which files a
stage saves, and which of them is the primary deliverable, is in that stage's
own output spec.

## The call

Call `write-session-documents` with:

| | |
|---|---|
| `toh` | the work's Toh number, e.g. `toh345` |
| `stage` | the stage doing the saving, e.g. `stage0` |
| `files` | one entry per file, each a `filename` and a `role` of `primary` or `supporting` |
| `model` | your model name, and its version only if you know it — see below |

The filename is the plain name the stage already generated, not a path. The
bucket is keyed by work and stage, so nothing is renamed at this boundary.

Do not pass `manifest.json`. The manifest recording the work, who saved the set,
when, and with what model is written for you, and is refused as an upload
precisely so its identity and timestamp are not yours to assert.

## The upload

The tool authorizes the writes and returns one `uploadUrl` per file, each valid
for two hours. **It does not carry the bytes** — PUT each file yourself, with
the `contentType` the response gives for that file:

```sh
curl -X PUT -H "Content-Type: <contentType>" --data-binary @<file> "<uploadUrl>"
```

That PUT is an outbound HTTP request the session makes itself, and it is the one
capability this step adds — the studio's other tools need nothing like it. Any
client that can read a local file's bytes and PUT them to a supplied URL is
sufficient: a shell, a code interpreter, or a plain HTTP-fetch tool all qualify,
and the `curl` above is only the most convenient form. The filesystem half is
already assumed, since a stage writes its deliverables to local files first.

If the client cannot make an outbound request, **say the documents could not be
saved to storage** rather than reporting a save that did not happen. The local
files are still the deliverables and the stage's findings still stand; what is
missing is the record the next stage reads, so a later session will find nothing
for this work and needs to be told why.

**The save is not complete until every PUT has succeeded.** The manifest is
written when the URLs are issued, so a file whose upload failed or was skipped
is described by the manifest but absent from storage. Check each response and
report any that failed.

## Repeat saves

A stage's files may be saved across more than one call — a report finished after
the main record, say. The manifest carries forward what an earlier call
recorded, so a second call does not erase the first.

Re-running a stage archives the previous revision of each path rather than
destroying it, so a re-run is recoverable. That is not on its own a reason to
re-run without telling the translator.

## On `model`

Record the name you know, and omit the version if you do not know it reliably.
An agent does not always know its own model version. Do not guess it, and do not
withhold the save over it.
