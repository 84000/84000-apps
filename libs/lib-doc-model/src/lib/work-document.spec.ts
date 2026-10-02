import { WorkDocument } from './work-document';
import { para, paraTexts, testSchema } from './schema.fixture';
import { build, meta, setContent, shape } from './work-document.fixture';

describe('WorkDocument structural ops', () => {
  describe('split', () => {
    it('leaves the head in place and puts the tail in a new passage', () => {
      const work = build(2);
      setContent(work, 'p0', [para('one', 'a'), para('two', 'b')]);
      // Position 5: after the first paragraph (1 + 3 text + 1 = 5).
      const result = work.split('p0', 5);

      expect(result?.uuid).toBe('new-0');
      expect(work.spine.uuids()).toEqual(['p0', 'new-0', 'p1']);
      expect(paraTexts(work.store.ensure('p0').toJSON())).toEqual(['one']);
      expect(paraTexts(work.store.ensure('new-0').toJSON())).toEqual(['two']);
    });

    // Cutting mid-paragraph leaves both halves with its uuid; saved, the new
    // passage's rows would take the head's.
    it('gives the tail of a split paragraph its own uuid', () => {
      const work = build(1);
      setContent(work, 'p0', [para('one two', 'a')]);
      const result = work.split('p0', 4);

      const uuidOf = (uuid: string) =>
        work.store.ensure(uuid).toJSON().content?.[0].attrs?.uuid;
      expect(uuidOf('p0')).toBe('a');
      expect(uuidOf(result?.uuid ?? '')).toEqual(expect.any(String));
      expect(uuidOf(result?.uuid ?? '')).not.toBe('a');
    });

    it('renumbers the labels below the split', () => {
      const work = build(3);
      work.split('p0', 0);
      expect(work.spine.entries().map((e) => e.label)).toEqual([
        '1',
        '2',
        '3',
        '4',
      ]);
    });

    it('returns null for an unknown passage', () => {
      expect(build(1).split('nope', 0)).toBeNull();
    });
  });

  describe('merge', () => {
    it('joins a passage into the one before it', () => {
      const work = build(3);
      const result = work.merge('p1');

      expect(result?.uuid).toBe('p0');
      expect(work.spine.uuids()).toEqual(['p0', 'p2']);
      expect(paraTexts(work.store.ensure('p0').toJSON())).toEqual([
        'text 0',
        'text 1',
      ]);
    });

    it('reports where the two joined', () => {
      const work = build(2);
      const before = work.store.ensure('p0').toNode().content.size;
      expect(work.merge('p1')?.boundary).toBe(before);
    });

    it('refuses to merge the first passage', () => {
      expect(build(2).merge('p0')).toBeNull();
    });
  });

  describe('insert', () => {
    it('inserts a passage with a derived label', () => {
      const work = build(3);
      const { uuid } = work.insert({ type: 'translation' }, 1);
      expect(work.spine.uuids()).toEqual(['p0', uuid, 'p1', 'p2']);
      expect(work.spine.meta(uuid)?.label).toBe('2');
      expect(work.spine.entries().map((e) => e.label)).toEqual([
        '1',
        '2',
        '3',
        '4',
      ]);
    });

    it('labels the first passage 1 when there is nothing above it', () => {
      const work = build(0);
      const { uuid } = work.insert({ type: 'translation' }, 0);
      expect(work.spine.meta(uuid)?.label).toBe('1');
    });

    it('gives an empty passage a paragraph to type into', () => {
      const work = build(1);
      const { uuid } = work.insert({ type: 'translation' }, 1);
      expect(work.store.ensure(uuid).toJSON().content).toHaveLength(1);
    });
  });

  describe('remove', () => {
    it('deletes passages and renumbers', () => {
      const work = build(4);
      expect(work.remove(['p1', 'p2'])).toBe(true);
      expect(work.spine.uuids()).toEqual(['p0', 'p3']);
      expect(work.spine.entries().map((e) => e.label)).toEqual(['1', '2']);
    });

    it('reports failure when nothing matched', () => {
      expect(build(2).remove(['nope'])).toBe(false);
    });
  });

  describe('replacePassages', () => {
    it('drops a run of passages', () => {
      const work = build(4);
      expect(work.replacePassages(['p1', 'p2'])).toBe(true);
      expect(work.spine.uuids()).toEqual(['p0', 'p3']);
    });

    it('puts the replacements where the run was', () => {
      const work = build(4);
      setContent(work, 'p1', [para('gone', 'a')]);

      expect(
        work.replacePassages(
          ['p1', 'p2'],
          [
            { type: 'translation', content: [para('fresh', 'x')] },
            { type: 'translation', content: [para('newer', 'y')] },
          ],
        ),
      ).toBe(true);

      expect(work.spine.uuids()).toEqual(['p0', 'new-0', 'new-1', 'p3']);
      expect(paraTexts(work.store.ensure('new-0').toJSON())).toEqual(['fresh']);
      expect(paraTexts(work.store.ensure('new-1').toJSON())).toEqual(['newer']);
    });

    it('numbers the replacements from the passage before them', () => {
      const work = build(4);
      work.replacePassages(
        ['p1', 'p2'],
        [{ type: 'translation', content: [para('fresh', 'x')] }],
      );

      expect(work.spine.entries().map((entry) => entry.label)).toEqual([
        '1',
        '2',
        '3',
      ]);
    });

    it('takes a shorter run than it replaces', () => {
      const work = build(4);
      expect(
        work.replacePassages(
          ['p1', 'p2'],
          [{ type: 'translation', content: [para('one', 'x')] }],
        ),
      ).toBe(true);
      expect(work.spine.uuids()).toEqual(['p0', 'new-0', 'p3']);
    });

    it('undoes a replacement in one step', () => {
      const work = build(4);
      setContent(work, 'p1', [para('original', 'a')]);
      const before = shape(work);

      work.replacePassages(
        ['p1', 'p2'],
        [{ type: 'translation', content: [para('fresh', 'x')] }],
      );
      expect(work.log.depth).toBe(1);

      work.undo();
      expect(work.spine.uuids()).toEqual(['p0', 'p1', 'p2', 'p3']);
      expect(shape(work)).toEqual(before);
    });

    it('undoes a plain delete of the run in one step', () => {
      const work = build(4);
      const before = shape(work);

      work.replacePassages(['p1', 'p2']);
      work.undo();

      expect(shape(work)).toEqual(before);
    });

    it('reports failure when nothing matched', () => {
      expect(build(2).replacePassages(['nope'])).toBe(false);
    });

    it('gives an empty replacement a block to hold the caret', () => {
      const work = build(3);
      work.replacePassages(['p1'], [{ type: 'translation', content: [] }]);
      expect(
        work.store
          .ensure('new-0')
          .toJSON()
          .content?.map((n) => n.type),
      ).toEqual(['paragraph']);
    });
  });

  describe('setLabel', () => {
    it('renames one passage and leaves the run alone', () => {
      const work = build(3);
      expect(work.setLabel('p1', '1.5')).toBe(true);
      expect(work.spine.entries().map((e) => e.label)).toEqual([
        '1',
        '1.5',
        '3',
      ]);
    });

    it('records nothing for a label that has not changed', () => {
      const work = build(2);
      expect(work.setLabel('p0', '1')).toBe(false);
      expect(work.log.depth).toBe(0);
    });

    it('undoes and redoes the rename', () => {
      const work = build(2);
      work.setLabel('p0', '7');

      expect(work.undo()).toEqual({ uuid: 'p0', where: 'start' });
      expect(work.spine.meta('p0')?.label).toBe('1');

      expect(work.redo()).toEqual({ uuid: 'p0', where: 'start' });
      expect(work.spine.meta('p0')?.label).toBe('7');
    });
  });

  describe('reorder', () => {
    it('moves a passage and renumbers', () => {
      const work = build(4);
      expect(work.reorder('p3', 0)).toBe(true);
      expect(work.spine.uuids()).toEqual(['p3', 'p0', 'p1', 'p2']);
      expect(work.spine.entries().map((e) => e.label)).toEqual([
        '1',
        '2',
        '3',
        '4',
      ]);
    });
  });
});

describe('WorkDocument merge at a blank seam', () => {
  /** A work of `count` passages whose content is set explicitly per passage. */
  const withContent = (contents: ReturnType<typeof para>[][]) => {
    const work = new WorkDocument({ workUuid: 'work-1', schema: testSchema });
    work.seedSpine(contents.map((_, i) => meta(`p${i}`, `${i + 1}`)));
    contents.forEach((content, i) =>
      work.store.ensure(`p${i}`).replaceContent({
        type: 'doc',
        content: content.length ? content : [],
      }),
    );
    return work;
  };

  const empty = () => para('', 'blank');

  // Reported: deleting an empty passage with Backspace left a blank line at the
  // end of the passage that absorbed it, and put the caret above that line —
  // because the boundary was the head's size before the concatenation.
  it('drops the blank paragraph when an empty passage is merged away', () => {
    const work = withContent([[para('text', 'a')], [empty()]]);

    const result = work.merge('p1');

    expect(paraTexts(work.store.ensure('p0').toJSON())).toEqual(['text']);
    // The caret belongs at the end of the surviving text, not past a blank.
    expect(result?.boundary).toBe(
      work.store.ensure('p0').toNode().content.size,
    );
  });

  it('drops a blank tail on the passage that absorbs content', () => {
    const work = withContent([
      [para('text', 'a'), empty()],
      [para('more', 'b')],
    ]);

    work.merge('p1');

    expect(paraTexts(work.store.ensure('p0').toJSON())).toEqual([
      'text',
      'more',
    ]);
  });

  it('keeps both when neither side of the seam is blank', () => {
    const work = withContent([[para('one', 'a')], [para('two', 'b')]]);

    work.merge('p1');

    expect(paraTexts(work.store.ensure('p0').toJSON())).toEqual(['one', 'two']);
  });

  it('leaves a block to hold the caret when both passages are blank', () => {
    const work = withContent([[empty()], [empty()]]);

    work.merge('p1');

    // Trimming both sides would leave a document with no blocks at all.
    expect(work.store.ensure('p0').toNode().childCount).toBe(1);
  });

  it('restores the blank paragraph on undo', () => {
    const work = withContent([[para('text', 'a')], [empty()]]);
    work.merge('p1');

    work.undo();

    expect(work.spine.uuids()).toEqual(['p0', 'p1']);
    expect(paraTexts(work.store.ensure('p0').toJSON())).toEqual(['text']);
    expect(work.store.ensure('p1').toNode().childCount).toBe(1);
  });
});

// An abbreviations run as production stores it: a header labelled `ab.`, then
// entries with no label, then the notes.
describe('WorkDocument in a run of unlabelled passages', () => {
  const abbreviations = () => {
    let next = 0;
    const work = new WorkDocument({
      workUuid: 'work-1',
      schema: testSchema,
      newUuid: () => `new-${next++}`,
    });
    work.seedSpine([
      meta('b0', '1.12'),
      meta('h', 'ab.', 'abbreviationsHeader'),
      meta('a0', '', 'abbreviations'),
      meta('a1', '', 'abbreviations'),
      meta('n0', 'n.1', 'endnotes'),
    ]);
    ['b0', 'h', 'a0', 'a1', 'n0'].forEach((uuid) =>
      work.store.create(uuid, [para(`text ${uuid}`, `p-${uuid}`)]),
    );
    return work;
  };
  const labels = (work: WorkDocument) =>
    work.spine.entries().map((entry) => entry.label);

  it('leaves the tail of a split entry unlabelled', () => {
    const work = abbreviations();
    work.split('a0', 3);
    expect(labels(work)).toEqual(['1.12', 'ab.', '', '', '', 'n.1']);
  });

  it('leaves an entry inserted after another unlabelled', () => {
    const work = abbreviations();
    work.insert({ type: 'abbreviations' }, 3);
    expect(labels(work)).toEqual(['1.12', 'ab.', '', '', '', 'n.1']);
  });

  it('leaves entries pasted after another unlabelled', () => {
    const work = abbreviations();
    work.replacePassages(
      ['a1'],
      [{ type: 'abbreviations' }, { type: 'abbreviations' }],
    );
    expect(labels(work)).toEqual(['1.12', 'ab.', '', '', '', 'n.1']);
  });

  it.each([
    ['an entry into the one before it', 'a1'],
    ['the first entry into the header', 'a0'],
  ])('relabels nothing merging %s', (_, uuid) => {
    const work = abbreviations();
    work.merge(uuid);
    expect(labels(work)).toEqual(['1.12', 'ab.', '', 'n.1']);
  });

  it('relabels nothing deleting an entry', () => {
    const work = abbreviations();
    work.remove(['a0']);
    expect(labels(work)).toEqual(['1.12', 'ab.', '', 'n.1']);
  });
});
