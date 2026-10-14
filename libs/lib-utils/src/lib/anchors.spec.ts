import { anchorOfLine, makeAnchors, MIN_ANCHOR_HEX } from './anchors';

const uuid = (hex: string) => {
  const h = hex.padEnd(32, '0');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

describe('makeAnchors', () => {
  it('uses the shortest prefix when nothing collides', () => {
    const anchors = makeAnchors([uuid('df68f324aa'), uuid('0dfac739bb')], 'p');
    expect([...anchors.values()]).toEqual(['p-df68f324', 'p-0dfac739']);
  });

  it('lengthens only the anchors that collide', () => {
    const a = uuid('abcdef12' + '1');
    const b = uuid('abcdef12' + '2');
    const c = uuid('11111111');
    const anchors = makeAnchors([a, b, c], 'p');
    expect(anchors.get(a)).toBe('p-abcdef121');
    expect(anchors.get(b)).toBe('p-abcdef122');
    expect(anchors.get(c)).toBe('p-11111111');
  });

  it('keeps lengthening until a deeper collision is resolved', () => {
    const a = uuid('abcdef12345a');
    const b = uuid('abcdef12345b');
    const anchors = makeAnchors([a, b], 'g');
    expect(anchors.get(a)).toBe('g-abcdef12345a');
    expect(anchors.get(b)).toBe('g-abcdef12345b');
  });

  it('gives every uuid a unique anchor, none a prefix of another', () => {
    // 4096 uuids over 16 bits of entropy in the first 8 hex digits force collisions.
    const uuids = Array.from({ length: 4096 }, (_, i) =>
      uuid(
        '0000' +
          (i % 1024).toString(16).padStart(4, '0') +
          Math.floor(i / 1024).toString(16) +
          'f',
      ),
    );
    const anchors = makeAnchors(uuids, 'p');
    const values = [...anchors.values()];
    expect(new Set(values).size).toBe(uuids.length);
    const sorted = [...values].sort();
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].startsWith(sorted[i - 1])).toBe(false);
    }
  });

  it('maps every anchor back to the uuid it was made from', () => {
    const uuids = [
      uuid('aa'),
      uuid('ab'),
      uuid('aaaaaaaab'),
      uuid('aaaaaaaac'),
    ];
    const anchors = makeAnchors(uuids, 'p');
    for (const [u, anchor] of anchors) {
      const hex = anchor.slice(2);
      expect(hex.length).toBeGreaterThanOrEqual(MIN_ANCHOR_HEX);
      expect(u.replace(/-/g, '').startsWith(hex)).toBe(true);
    }
  });

  it('does not depend on input order', () => {
    const uuids = [uuid('abcdef121'), uuid('abcdef122'), uuid('12345678')];
    expect(makeAnchors(uuids, 'p')).toEqual(
      makeAnchors([...uuids].reverse(), 'p'),
    );
  });
});

describe('anchorOfLine', () => {
  it('reads the anchor a line starts with', () => {
    expect(anchorOfLine('[p-df68f324 1.2] Thus did I hear')).toBe('p-df68f324');
    expect(anchorOfLine('[b-14c3703f] ## Texts')).toBe('b-14c3703f');
    expect(anchorOfLine('Thus [p-df68f324]')).toBeNull();
  });
});
