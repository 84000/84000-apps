/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  contentSourceFromEnv: jest.fn(() => 'draft'),
}));

jest.mock('@eightyfourthousand/data-access/ssr', () => ({
  createAnonServerClient: jest.fn(),
  lookupEntityWithClient: jest.fn(async () => ({})),
}));

const ORIGIN = 'http://localhost:3002';
const WORK = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';

const rewrittenPath = async (query: string) => {
  const response = await proxy(
    new NextRequest(`${ORIGIN}/translation/${WORK}?${query}`),
  );
  const header = response.headers.get('x-middleware-rewrite');
  return header ? new URL(header, ORIGIN).pathname : undefined;
};

describe('proxy', () => {
  it.each([
    ['a backslash path', `toh=${encodeURIComponent('toh8\\..\\..\\entity')}`],
    ['an encoded slash', `toh=${encodeURIComponent('toh8/../entity')}`],
    ['a dot segment', 'toh=toh8%2F..'],
    ['upper case', 'toh=TOH847'],
    ['a loose form', `toh=${encodeURIComponent('Toh 847')}`],
  ])('reads the default for %s', async (_label, query) => {
    expect(await rewrittenPath(query)).toBe(`/translation/${WORK}/default`);
  });

  it('keeps a suffixed Toh', async () => {
    expect(await rewrittenPath('toh=toh1-1')).toBe(
      `/translation/${WORK}/toh1-1`,
    );
  });
});
