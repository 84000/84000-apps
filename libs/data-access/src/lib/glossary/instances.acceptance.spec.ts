// Acceptance tests for DEV-912 (glossary instances table), criteria 2 and 3:
// what a row shows around its match, and the page size. Written from the
// issue's acceptance criteria and public interfaces, not from the code.
import {
  GLOSSARY_INSTANCES_PAGE_SIZE,
  cutGlossaryInstanceContext,
} from '../../index';

const words = (text: string) => text.split(/\s+/).filter(Boolean);

const lorem = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `w${from + i}`).join(' ');

/** Content with TARGET between `w1..w{before}` and `w{before+1}..`. */
const around = (before: number, after: number) => {
  const head = before ? `${lorem(1, before)} ` : '';
  const tail = after ? ` ${lorem(before + 1, before + after)}` : '';
  const content = `${head}TARGET${tail}`;
  const start = content.indexOf('TARGET');
  return { content, start, end: start + 'TARGET'.length };
};

describe('DEV-912 criterion 3: page size', () => {
  it('criterion 3: rows load 50 to a page', () => {
    expect(GLOSSARY_INSTANCES_PAGE_SIZE).toBe(50);
  });
});

describe('DEV-912 criterion 2: the matched text with up to five words either side', () => {
  it('criterion 2: the matched text is what the offsets cover', () => {
    const { content, start, end } = around(8, 8);

    const cut = cutGlossaryInstanceContext(content, start, end);

    expect(cut.text).toBe('TARGET');
    expect(cut.outOfRange).toBe(false);
  });

  it('criterion 2: up to five words either side, cut from a longer passage', () => {
    const { content, start, end } = around(12, 12);

    const cut = cutGlossaryInstanceContext(content, start, end);

    expect(words(cut.before)).toEqual(['w8', 'w9', 'w10', 'w11', 'w12']);
    expect(words(cut.after)).toEqual(['w13', 'w14', 'w15', 'w16', 'w17']);
  });

  it('criterion 2: a cut flags that text lies beyond it, on each side', () => {
    const { content, start, end } = around(12, 12);

    const cut = cutGlossaryInstanceContext(content, start, end);

    expect(cut.truncatedStart).toBe(true);
    expect(cut.truncatedEnd).toBe(true);
  });

  it('criterion 2: exactly five words either side is not a cut', () => {
    const { content, start, end } = around(5, 5);

    const cut = cutGlossaryInstanceContext(content, start, end);

    expect(words(cut.before)).toEqual(['w1', 'w2', 'w3', 'w4', 'w5']);
    expect(words(cut.after)).toEqual(['w6', 'w7', 'w8', 'w9', 'w10']);
    expect(cut.truncatedStart).toBe(false);
    expect(cut.truncatedEnd).toBe(false);
  });

  it('criterion 2: fewer than five words available shows all of them', () => {
    const { content, start, end } = around(2, 3);

    const cut = cutGlossaryInstanceContext(content, start, end);

    expect(words(cut.before)).toEqual(['w1', 'w2']);
    expect(words(cut.after)).toEqual(['w3', 'w4', 'w5']);
    expect(cut.truncatedStart).toBe(false);
    expect(cut.truncatedEnd).toBe(false);
  });

  it('criterion 2: an instance at the start of the passage has nothing before it', () => {
    const { content, start, end } = around(0, 9);

    const cut = cutGlossaryInstanceContext(content, start, end);

    expect(words(cut.before)).toEqual([]);
    expect(cut.truncatedStart).toBe(false);
    expect(words(cut.after)).toHaveLength(5);
    expect(cut.truncatedEnd).toBe(true);
  });

  it('criterion 2: an instance at the end of the passage has nothing after it', () => {
    const { content, start, end } = around(9, 0);

    const cut = cutGlossaryInstanceContext(content, start, end);

    expect(words(cut.after)).toEqual([]);
    expect(cut.truncatedEnd).toBe(false);
    expect(words(cut.before)).toHaveLength(5);
    expect(cut.truncatedStart).toBe(true);
  });

  it('criterion 2: a match of several words is shown whole, with five words either side of it', () => {
    const content = `${lorem(1, 8)} two words here ${lorem(9, 16)}`;
    const start = content.indexOf('two');
    const end = start + 'two words here'.length;

    const cut = cutGlossaryInstanceContext(content, start, end);

    expect(cut.text).toBe('two words here');
    expect(words(cut.before)).toEqual(['w4', 'w5', 'w6', 'w7', 'w8']);
    expect(words(cut.after)).toEqual(['w9', 'w10', 'w11', 'w12', 'w13']);
  });

  it('criterion 2: the word count can be set', () => {
    const { content, start, end } = around(12, 12);

    const cut = cutGlossaryInstanceContext(content, start, end, 2);

    expect(words(cut.before)).toEqual(['w11', 'w12']);
    expect(words(cut.after)).toEqual(['w13', 'w14']);
  });

  it('criterion 2: offsets count UTF-16 code units, as annotation offsets do', () => {
    const content = `one 😀 two three TARGET four 😀 five`;
    const start = content.indexOf('TARGET');

    const cut = cutGlossaryInstanceContext(content, start, start + 6);

    expect(cut.text).toBe('TARGET');
    expect(words(cut.before)).toEqual(['one', '😀', 'two', 'three']);
    expect(words(cut.after)).toEqual(['four', '😀', 'five']);
  });
});

describe('DEV-912 risk note: offsets outside the text show a warning, not a failure', () => {
  it('criterion 2: an instance wholly past the end of the passage is flagged out of range', () => {
    const content = 'A short passage.';

    const cut = cutGlossaryInstanceContext(content, 500, 510);

    expect(cut.outOfRange).toBe(true);
    expect(typeof cut.before).toBe('string');
    expect(typeof cut.text).toBe('string');
    expect(typeof cut.after).toBe('string');
  });

  it('criterion 2: an instance in an empty passage is flagged out of range, not thrown', () => {
    expect(() => cutGlossaryInstanceContext('', 3, 9)).not.toThrow();
    expect(cutGlossaryInstanceContext('', 3, 9).outOfRange).toBe(true);
  });

  it('criterion 2: an instance inside the passage is not flagged', () => {
    const { content, start, end } = around(3, 3);

    expect(cutGlossaryInstanceContext(content, start, end).outOfRange).toBe(
      false,
    );
  });
});
