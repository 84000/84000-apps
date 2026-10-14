# editor-eval-report.json

A JSON array with one object per spec ID that was in scope, sorted by ID.

```json
[
  {
    "id": "ED-NAV-01",
    "result": "fail",
    "kind": "judged",
    "evidence": {
      "dom": "probe `div.z-100 > div.bg-popover` after hovering the endnote link in 1.20: 0 elements; same probe on the glossary instance in 2.5: 1 element, text 'great compassion …'",
      "sql": "select ... -> (output)"
    },
    "repro": ["Open /translations/editor/<work>?toh=toh90001", "Scroll to 1.20 and hover the end-note link at the end of the passage", "No card appears"]
  }
]
```

| Field      | Required   | Meaning                                                                                                                                                                                                                                                                                                                          |
| ---------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`       | yes        | The spec ID, `ED-<SECTION>-<nn>`. A D + J item has one entry; give it the worse of its two results.                                                                                                                                                                                                                              |
| `result`   | yes        | `pass`, `fail`, or `blocked` (could not be checked: say why in `evidence`).                                                                                                                                                                                                                                                      |
| `kind`     | yes        | `deterministic`, `judged`, or `both`.                                                                                                                                                                                                                                                                                            |
| `evidence` | yes        | At least one of `dom`, `sql` or `test`. `dom` quotes what the probe read on the visible element. `sql` is the query and its output. `test` is the Playwright test title and status (from `collect-results.mjs`). For a missing element, `dom` must also show the same probe finding the element where it is known to be present. |
| `repro`    | for `fail` | Steps a developer can follow by hand, from opening the editor.                                                                                                                                                                                                                                                                   |
| `known`    | no         | The issue the spec's **Known** line names, or the test's `test.fail` reason, when the failure matches it.                                                                                                                                                                                                                        |
| `note`     | no         | Anything else, such as a flaky result or a part left for a human.                                                                                                                                                                                                                                                                |

A `pass` needs evidence that agrees with the spec's **Screen** and **Stored**
lines. A claim from the app ("Saved") is not evidence.
