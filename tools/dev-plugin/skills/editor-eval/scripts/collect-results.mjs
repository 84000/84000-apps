// Turns a Playwright JSON report of the web-main-e2e suite into
// editor-eval report entries, one per spec ID, on stdout.
//
//   node collect-results.mjs <playwright-report.json>
//
// A test's ID is the ED-XXX-nn at the start of its title. An expected
// failure (test.fail) that fails as expected is a "fail" with its reason as
// the known issue, and one that passes is a "pass" with a note to drop the
// marker; a skipped test (test.fixme) is "blocked"; a flaky test is a "fail".
// When several
// tests share an ID, the worst result wins (fail > blocked > pass).
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node collect-results.mjs <playwright-report.json>');
  process.exit(1);
}
const report = JSON.parse(readFileSync(file, 'utf8'));
const rank = { pass: 0, blocked: 1, fail: 2 };
const entries = new Map();

const visit = (suite) => {
  for (const spec of suite.specs ?? []) {
    const id = spec.title.match(/^ED-[A-Z]+-\d+/)?.[0];
    if (!id) continue;
    for (const test of spec.tests ?? []) {
      if (test.projectName && test.projectName !== 'chromium') continue;
      const last = test.results?.at(-1);
      const reason = test.annotations
        ?.map((a) => [a.type, a.description].filter(Boolean).join(': '))
        .join('; ');
      let result;
      let note;
      if (test.status === 'skipped') result = 'blocked';
      else if (test.expectedStatus === 'failed') {
        // test.fail: failing is the known bug; passing means it is fixed.
        result = test.status === 'expected' ? 'fail' : 'pass';
        if (result === 'pass')
          note = 'known bug no longer reproduces: remove test.fail';
      } else if (test.status === 'flaky') {
        result = 'fail';
        note = 'flaky: failed, then passed on retry';
      } else result = test.status === 'expected' ? 'pass' : 'fail';
      const entry = {
        id,
        result,
        kind: 'deterministic',
        evidence: {
          test: `${spec.file}: ${spec.title}`,
          status: last?.status,
          ...(reason ? { known: reason } : {}),
          ...(note ? { note } : {}),
          ...(last?.error?.message
            ? { error: last.error.message.slice(0, 500) }
            : {}),
        },
      };
      const prev = entries.get(id);
      if (!prev || rank[result] > rank[prev.result]) entries.set(id, entry);
    }
  }
  for (const child of suite.suites ?? []) visit(child);
};
for (const suite of report.suites ?? []) visit(suite);

process.stdout.write(
  JSON.stringify(
    [...entries.values()].sort((a, b) => a.id.localeCompare(b.id)),
    null,
    2,
  ) + '\n',
);
