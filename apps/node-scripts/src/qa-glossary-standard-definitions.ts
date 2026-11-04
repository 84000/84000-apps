/**
 * Publication QA: glossary entries hidden behind a standard definition that does not exist.
 *
 * Same check as the studio MCP tool `qa-glossary-standard-definitions`, and the same
 * code (`getStandardDefinitionGaps` in data-access), so the CLI cannot drift from what
 * the agent sees. Read-only.
 *
 * Run:
 *   npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/qa-glossary-standard-definitions.ts <work-uuid | toh>
 *   npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/qa-glossary-standard-definitions.ts <work-uuid | toh> --json
 *
 *   # also list other works' published definitions for each gap's authority,
 *   # and where the term is used in this work's draft
 *   npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/qa-glossary-standard-definitions.ts <work-uuid | toh> --candidates --contexts
 *
 * Exits 1 when any gap is found, so it can gate a script.
 */

import './load-env';
import {
  getAuthorityGlossaryEntries,
  getGlossaryTermContexts,
  getStandardDefinitionGaps,
} from '@eightyfourthousand/data-access';
import {
  createServiceRoleClient,
  resolveWork,
} from '@eightyfourthousand/lib-publishing/ssr';

const main = async () => {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const withCandidates = args.includes('--candidates');
  const withContexts = args.includes('--contexts');
  const work = args.find((a) => !a.startsWith('--'));
  if (!work) {
    console.error(
      'Usage: qa-glossary-standard-definitions.ts <work-uuid | toh> [--json]',
    );
    process.exit(2);
  }

  const client = createServiceRoleClient();
  const resolved = await resolveWork({ client, work });
  if (!resolved) {
    console.error(`No work found for "${work}".`);
    process.exit(2);
  }

  const report = await getStandardDefinitionGaps({
    client,
    workUuid: resolved.uuid,
  });

  const authorities =
    withCandidates && report.gaps.length
      ? await getAuthorityGlossaryEntries({
          client,
          authorityUuids: report.gaps.map((gap) => gap.authorityUuid),
          excludeWorkUuid: resolved.uuid,
        })
      : [];
  const candidatesFor = (authorityUuid: string) =>
    authorities.find((a) => a.authorityUuid === authorityUuid)?.entries ?? [];

  const contexts = withContexts
    ? await Promise.all(
        report.gaps.map((gap) =>
          getGlossaryTermContexts({
            client,
            glossaryUuid: gap.glossaryUuid,
            limit: 3,
            source: 'draft',
          }),
        ),
      )
    : [];

  if (json) {
    console.log(
      JSON.stringify(
        {
          ...report,
          gaps: report.gaps.map((gap, i) => ({
            ...gap,
            ...(withCandidates
              ? { candidates: candidatesFor(gap.authorityUuid) }
              : {}),
            ...(withContexts ? { contexts: contexts[i].contexts } : {}),
          })),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`Work ${resolved.toh ?? ''} (${resolved.uuid})`);
    console.log(
      `${report.placeholders} placeholder definition(s) set to overrideWithStandard; ` +
        `${report.covered} covered by a standard definition; ` +
        `${report.gaps.length} without one.`,
    );
    report.gaps.forEach((gap, i) => {
      console.log('');
      console.log(
        `  ${gap.term ?? '(no name)'} — headword: ${gap.headword ?? '(authority missing)'}`,
      );
      console.log(`    glossary:  ${gap.glossaryUuid}`);
      console.log(`    authority: ${gap.authorityUuid}`);
      console.log(`    hidden:    ${gap.definition ?? ''}`);
      if (withContexts) {
        const found = contexts[i].contexts;
        console.log(
          `    contexts:  ${found.length ? '' : 'none (no glossary instances for this entry)'}`,
        );
        for (const context of found) {
          for (const snippet of context.snippets) {
            console.log(`      [${context.label}] ${snippet}`);
          }
        }
      }
      if (withCandidates) {
        const candidates = candidatesFor(gap.authorityUuid);
        console.log(
          `    candidates: ${candidates.length ? '' : 'none published in other works'}`,
        );
        for (const candidate of candidates) {
          console.log(
            `      ${candidate.work.toh.join(', ') || candidate.work.uuid} (${candidate.glossaryUuid}): ${candidate.definition}`,
          );
        }
      }
    });
  }

  process.exit(report.gaps.length > 0 ? 1 : 0);
};

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
