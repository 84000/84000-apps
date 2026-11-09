/**
 * ED-1647 acceptance: a mention node item's subtype/linkToh survive export to
 * an annotation and then to the stored annotation DTO's content.
 *
 * Criteria: (1) subtype persisted, (2) linkToh persisted as `toh`,
 * (4) other mentions persisted as before.
 */
import type { Node } from '@tiptap/pm/model';
import { annotationToDTO } from '@eightyfourthousand/data-access';
import { mention } from './mention';

type Item = Record<string, unknown>;

/** Export one mention node holding `item`, then serialise it to a DTO. */
const persist = (item: Item) => {
  const node = {
    attrs: { items: [{ uuid: 'm-1', ...item }] },
  } as unknown as Node;
  const [annotation] =
    mention({
      node,
      parent: node,
      root: node,
      start: 7,
      passageUuid: 'passage-1',
    }) ?? [];
  return { annotation, dto: annotationToDTO(annotation) };
};

describe('mention persistence of the target location (ED-1647)', () => {
  it('criterion 1+2: persists subtype and linkToh into the DTO content', () => {
    const { annotation, dto } = persist({
      entity: 'p-1',
      linkType: 'passage',
      isSameWork: true,
      subtype: 'endnotes',
      linkToh: 'toh12',
    });

    expect(annotation).toMatchObject({
      type: 'mention',
      subtype: 'endnotes',
      linkToh: 'toh12',
    });
    expect(dto?.type).toBe('mention');
    expect(dto?.content).toEqual(
      expect.arrayContaining([
        { uuid: 'p-1' },
        { type: 'passage' },
        { same_work: true },
        { subtype: 'endnotes' },
        { toh: 'toh12' },
      ]),
    );
  });

  it('criterion 1: persists subtype alone', () => {
    const { dto } = persist({
      entity: 'p-1',
      linkType: 'passage',
      isSameWork: true,
      subtype: 'introduction',
    });

    expect(dto?.content).toEqual(
      expect.arrayContaining([{ subtype: 'introduction' }]),
    );
    expect(dto?.content.some((c) => 'toh' in c)).toBe(false);
  });

  it.each(['work', 'glossary', 'bibliography', 'folio'])(
    'criterion 4: a %s mention persists without subtype or toh content',
    (linkType) => {
      const { dto } = persist({
        entity: 'e-1',
        linkType,
        isSameWork: linkType !== 'work',
      });

      expect(dto?.content).toEqual(
        expect.arrayContaining([{ uuid: 'e-1' }, { type: linkType }]),
      );
      expect(dto?.content.some((c) => 'subtype' in c)).toBe(false);
      expect(dto?.content.some((c) => 'toh' in c)).toBe(false);
    },
  );
});
