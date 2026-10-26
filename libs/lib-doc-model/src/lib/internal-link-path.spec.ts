import { internalLinkPath } from './internal-link-path';

describe('internalLinkPath', () => {
  it('goes to the target entity when the link has one', () => {
    expect(
      internalLinkPath({
        href: 'UT22084-001-006-chapter-9',
        type: 'passage',
        entity: 'e1',
      }),
    ).toBe('/entity/passage/e1');
  });

  it('turns a stored hash into an xmlId query', () => {
    expect(
      internalLinkPath({ href: '/translation/toh8#UT22084-014-001-1' }),
    ).toBe('/translation/toh8?xmlId=UT22084-014-001-1');
  });

  it('keeps an href with no hash', () => {
    expect(internalLinkPath({ href: '/translation/toh1-17' })).toBe(
      '/translation/toh1-17',
    );
  });
});
