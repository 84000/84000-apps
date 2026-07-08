import { Doc, XmlElement, XmlFragment, XmlText, YEvent } from 'yjs';
import {
  captureFragmentBaseline,
  collectPassageUuids,
  diffPassageUuids,
  findObservedFragment,
  shouldRescanFragment,
} from './observer-utils';

const passageElement = (uuid: string, text = 'content') => {
  const passage = new XmlElement('passage');
  passage.setAttribute('uuid', uuid);
  const paragraph = new XmlElement('paragraph');
  paragraph.insert(0, [new XmlText(text)]);
  passage.insert(0, [paragraph]);
  return passage;
};

const setup = (uuids: string[]) => {
  const doc = new Doc();
  const fragment = doc.getXmlFragment('translation');
  doc.transact(() => {
    fragment.insert(0, uuids.map((uuid) => passageElement(uuid)));
  });

  let captured: YEvent<XmlFragment | XmlElement>[] = [];
  let rescan: boolean | undefined;
  let baseline: ReturnType<typeof captureFragmentBaseline> | undefined;

  // shouldRescanFragment may touch event.changes, which Yjs only allows
  // INSIDE the observer callback (as the production observer does) — so the
  // gate must be evaluated here, not after the handler returns.
  fragment.observeDeep((events) => {
    captured = events as YEvent<XmlFragment | XmlElement>[];
    rescan = shouldRescanFragment(captured, fragment, baseline);
  });

  return {
    doc,
    fragment,
    events: () => captured,
    rescan: () => rescan,
    setBaseline: (next: ReturnType<typeof captureFragmentBaseline>) => {
      baseline = next;
    },
  };
};

describe('collectPassageUuids / captureFragmentBaseline', () => {
  it('collects top-level passage uuids and records the fragment length', () => {
    const { fragment } = setup(['p-1', 'p-2']);

    const baseline = captureFragmentBaseline(fragment);

    expect(Array.from(baseline.uuids).sort()).toEqual(['p-1', 'p-2']);
    expect(baseline.length).toBe(2);
  });

  it('skips passages without a uuid', () => {
    const { doc, fragment } = setup(['p-1']);
    doc.transact(() => {
      fragment.insert(1, [new XmlElement('passage')]);
    });

    expect(Array.from(collectPassageUuids(fragment))).toEqual(['p-1']);
  });
});

describe('findObservedFragment', () => {
  it('walks up from a nested event target to the root fragment', () => {
    const { doc, fragment, events } = setup(['p-1']);

    // A text edit deep inside a passage produces events targeting the
    // nested XmlText, not the fragment.
    doc.transact(() => {
      const paragraph = (fragment.get(0) as XmlElement).get(0) as XmlElement;
      (paragraph.get(0) as XmlText).insert(0, 'x');
    });

    expect(events().length).toBeGreaterThan(0);
    expect(findObservedFragment(events())).toBe(fragment);
  });

  it('returns null for empty event lists', () => {
    expect(findObservedFragment([])).toBeNull();
  });
});

describe('shouldRescanFragment', () => {
  it('does not rescan for a text-only edit', () => {
    const { doc, fragment, rescan, setBaseline } = setup(['p-1', 'p-2']);
    setBaseline(captureFragmentBaseline(fragment));

    doc.transact(() => {
      const paragraph = (fragment.get(0) as XmlElement).get(0) as XmlElement;
      (paragraph.get(0) as XmlText).insert(0, 'typing');
    });

    expect(rescan()).toBe(false);
  });

  it('rescans when a passage is inserted', () => {
    const { doc, fragment, rescan, setBaseline } = setup(['p-1']);
    setBaseline(captureFragmentBaseline(fragment));

    doc.transact(() => {
      fragment.insert(1, [passageElement('p-2')]);
    });

    expect(rescan()).toBe(true);
  });

  it('rescans when a passage is deleted', () => {
    const { doc, fragment, rescan, setBaseline } = setup(['p-1', 'p-2']);
    setBaseline(captureFragmentBaseline(fragment));

    doc.transact(() => {
      fragment.delete(1, 1);
    });

    expect(rescan()).toBe(true);
  });

  it('rescans an equal-length top-level replace via fragment deltas', () => {
    const { doc, fragment, rescan, setBaseline } = setup(['p-1', 'p-2']);
    const baseline = captureFragmentBaseline(fragment);
    setBaseline(baseline);

    // Delete + insert in one transaction: length is unchanged, but the
    // event targeting the fragment carries add/delete deltas.
    doc.transact(() => {
      fragment.delete(0, 1);
      fragment.insert(0, [passageElement('p-replacement')]);
    });

    expect(fragment.length).toBe(baseline.length);
    expect(rescan()).toBe(true);
  });

  it('rescans when there is no baseline yet', () => {
    const { fragment } = setup(['p-1']);
    expect(shouldRescanFragment([], fragment, undefined)).toBe(true);
  });
});

describe('diffPassageUuids', () => {
  it('reports additions and detects deletions', () => {
    const { added, hasDeleted } = diffPassageUuids(
      new Set(['p-1', 'p-2']),
      new Set(['p-2', 'p-3']),
    );

    expect(added).toEqual(['p-3']);
    expect(hasDeleted).toBe(true);
  });

  it('reports no changes for identical sets', () => {
    const { added, hasDeleted } = diffPassageUuids(
      new Set(['p-1']),
      new Set(['p-1']),
    );

    expect(added).toEqual([]);
    expect(hasDeleted).toBe(false);
  });
});
