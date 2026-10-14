// Turns a Playwright JSON report of the web-main-e2e suite into
// editor-eval report entries, one per spec ID, on stdout.
//
//   node collect-results.mjs <playwright-report.json>
//
// A test's ID is the ED-XXX-nn at the start of its title.
// - A passing test is a "pass".
// - An expected failure (test.fail) that fails is a "fail", with its reason
//   in `known`. One that passes is a "pass" with a note to drop the marker.
//   One that times out or errors in another way is a "fail".
// - A skipped test (test.fixme) is "blocked", with its reason in `note`.
// - A flaky test (failed, then passed on retry) is a "fail".
// When several tests share an ID, the worst result wins
// (fail > blocked > pass). D + J items get kind "deterministic" here; the
// skill sets "both" when it adds the judged part.
//
// Exits 1, printing the errors, when the run itself failed (global setup,
// the sign-in project) instead of reporting every test as blocked.
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node collect-results.mjs <playwright-report.json>');
  process.exit(1);
}
const report = JSON.parse(readFileSync(file, 'utf8'));
const runErrors = (report.errors ?? []).map((e) => e.message ?? String(e));
const rank = { pass: 0, blocked: 1, fail: 2 };
const entries = new Map();

const describe = (test, types) =>
  test.annotations
    ?.filter((a) => types.includes(a.type) && a.description)
    .map((a) => a.description)
    .join('; ') || undefined;

const visit = (suite) => {
  for (const spec of suite.specs ?? []) {
    const id = spec.title.match(/^ED-[A-Z]+-\d+/)?.[0];
    for (const test of spec.tests ?? []) {
      const last = test.results?.at(-1);
      if (!id) {
        // The sign-in project: if it fails, every test after it is skipped.
        if (test.status === 'unexpected') {
          runErrors.push(`${spec.title}: ${last?.error?.message ?? 'failed'}`);
        }
        continue;
      }
      if (test.projectName && test.projectName !== 'chromium') continue;
      let result;
      let known;
      let note;
      if (test.status === 'skipped') {
        if (test.expectedStatus !== 'skipped') {
          runErrors.push(`${spec.title}: did not run`);
          continue;
        }
        result = 'blocked';
        note = describe(test, ['fixme', 'skip']);
      } else if (test.expectedStatus === 'failed') {
        if (test.status === 'expected') {
          result = 'fail';
          known = describe(test, ['fail']);
        } else if (last?.status === 'passed') {
          result = 'pass';
          note = 'the known bug no longer reproduces: drop test.fail';
        } else {
          result = 'fail';
          note = `expected failure ended as ${last?.status}, not on its assertion`;
        }
      } else if (test.status === 'flaky') {
        result = 'fail';
        note = 'flaky: failed, then passed on retry';
      } else {
        result = test.status === 'expected' ? 'pass' : 'fail';
      }
      const entry = {
        id,
        result,
        kind: 'deterministic',
        evidence: {
          test: `${spec.file}: ${spec.title}`,
          status: last?.status,
          ...(last?.error?.message && result === 'fail'
            ? { error: last.error.message.slice(0, 500) }
            : {}),
        },
        ...(known ? { known } : {}),
        ...(note ? { note } : {}),
      };
      const prev = entries.get(id);
      if (!prev || rank[result] > rank[prev.result]) entries.set(id, entry);
    }
  }
  for (const child of suite.suites ?? []) visit(child);
};
for (const suite of report.suites ?? []) visit(suite);

if (runErrors.length) {
  console.error('The run did not complete:');
  for (const error of runErrors) console.error(`- ${error.slice(0, 500)}`);
  process.exit(1);
}
process.stdout.write(
  JSON.stringify(
    [...entries.values()].sort((a, b) => a.id.localeCompare(b.id)),
    null,
    2,
  ) + '\n',
);
