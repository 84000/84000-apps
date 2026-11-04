# Running eft

`eft` is 84000's command line. A skill that uses it ships a launcher for it in
its `scripts/` folder. Run eft only through the launcher, from the working
folder (the one `84000/` is in):

```sh
sh "<this skill>/scripts/eft.sh" <command> …
```

On Windows without `sh`, use the PowerShell launcher instead:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "<this skill>/scripts/eft.ps1" <command> …
```

The first run downloads the eft program for this computer (about 90 MB) into
`84000/cache/bin/eft/<version>/`, as `reference/local-files/layout.md` says,
and later runs reuse it. Mention the download to the user the first time. If
the 84000 root is not `84000/` in the working folder, give the launcher the
root: `EFT_84000_ROOT="<root>" sh "<this skill>/scripts/eft.sh" …`.

The launcher checks the program against the checksum this skill pins before
every run. Never run a program from the cache yourself, and never download eft
any other way.

What the launcher says goes to stderr; stdout is eft's own output.

- **`downloading eft …`**: the first run. Expected.
- **`… running the bundled eft.mjs with node instead`**: no program fits this
  computer, or the download failed, so the launcher ran the bundled script.
  The results are the same.
- **`refusing to run the downloaded …`**: the program did not match its
  checksum, and nothing was run. Stop and tell the user. Do not work around
  it: report it to the 84000 team with `send-feedback`.
- **`… and node is not installed`**: eft cannot run here. Tell the user which
  step was skipped because of it.
