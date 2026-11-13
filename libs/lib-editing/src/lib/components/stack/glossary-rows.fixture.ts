import type {
  DataClient,
  GlossaryEntry,
  GlossaryTermNode,
} from '@eightyfourthousand/data-access';

import { loadGlossaryWork, type GlossaryWork } from './glossary-work';

// Glossary rows for specs that mock `getWorkGlossaryTermsPage` and
// `getGlossaryEntries`.

export const WORK = 'w1';
export const client = {} as DataClient;

export const entry = (uuid: string, workUuid = WORK): GlossaryEntry => ({
  uuid,
  workUuid,
  authorityUuid: `a-${uuid}`,
  definition: `<p>${uuid} defined.</p>`,
  definitionRend: null,
  glossMode: 'match',
  names: [],
});

export const node = (uuid: string, termNumber: number) =>
  ({
    uuid,
    authority: `a-${uuid}`,
    termNumber,
    definition: `<p>${uuid} defined.</p>`,
    names: { english: uuid },
  }) as GlossaryTermNode;

export const page = (nodes: GlossaryTermNode[], more = { after: false }) => ({
  nodes,
  pageInfo: {
    nextCursor: nodes.at(-1)?.uuid ?? null,
    prevCursor: null,
    hasMoreAfter: more.after,
    hasMoreBefore: false,
  },
  totalCount: 9,
});

/** A glossary whose first page holds t1, t2, t3. */
export const loaded = async (
  mocks: { page: jest.Mock; entries: jest.Mock },
  more = { after: false },
) => {
  mocks.page.mockResolvedValueOnce(
    page([node('t1', 1), node('t2', 2), node('t3', 3)], more),
  );
  mocks.entries.mockImplementation(async ({ uuids }: { uuids: string[] }) =>
    uuids.map((uuid) => entry(uuid)),
  );
  return (await loadGlossaryWork({
    workUuid: WORK,
    client,
    graphql: {} as never,
  })) as GlossaryWork;
};

export const rows = (glossary: GlossaryWork) =>
  glossary.work.spine.entries().map(({ uuid, label }) => `${label} ${uuid}`);
