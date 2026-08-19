import type { JSONContent } from '@tiptap/core';
import { renderToHTMLString } from '@tiptap/static-renderer/pm/html-string';

import { translationSSRExtensions } from '../translationSSRExtensions';
import { renderTextToHTMLString } from './pipeNotItalicSSRMapping';

const render = (content: JSONContent) =>
  renderToHTMLString({
    content,
    extensions: translationSSRExtensions,
    options: { nodeMapping: { text: renderTextToHTMLString } },
  });

const para = (...content: JSONContent[]): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph', content }],
});

const UPRIGHT = '<span class="not-italic" style="font-style:normal">|</span>';

describe('renderTextToHTMLString', () => {
  it('keeps the danda upright inside an italic mark', () => {
    const html = render(
      para({
        type: 'text',
        text: 'gang gi | blo gros',
        marks: [{ type: 'italic', attrs: { textStyle: 'emphasis' } }],
      }),
    );
    expect(html).toContain(`gang gi ${UPRIGHT} blo gros`);
  });

  it('keeps the danda upright inside a foreign mark, which has no italic mark', () => {
    const html = render(
      para({
        type: 'text',
        text: 'oṃ | āḥ hūṃ',
        marks: [
          { type: 'foreign', attrs: { lang: 'Sa-Ltn', textStyle: 'foreign' } },
        ],
      }),
    );
    expect(html).toContain(`oṃ ${UPRIGHT} āḥ hūṃ`);
  });

  it('keeps the danda upright inside a mantra mark', () => {
    const html = render(
      para({
        type: 'text',
        text: 'tadyathā | svāhā',
        marks: [{ type: 'mantra', attrs: { lang: 'Sa-Ltn' } }],
      }),
    );
    expect(html).toContain(`tadyathā ${UPRIGHT} svāhā`);
  });

  it('wraps every danda in a run, including a doubled one', () => {
    const html = render(
      para({
        type: 'text',
        text: 'a | b ||',
        marks: [{ type: 'italic' }],
      }),
    );
    expect(html).toContain(`a ${UPRIGHT} b ${UPRIGHT}${UPRIGHT}`);
  });

  it('leaves dandas in upright text alone', () => {
    const html = render(para({ type: 'text', text: 'plain | text' }));
    expect(html).toContain('plain | text');
    expect(html).not.toContain(UPRIGHT);
  });

  it('leaves dandas alone under a lang the design system does not italicise', () => {
    const html = render(
      para({
        type: 'text',
        text: '大 | 乘',
        marks: [{ type: 'foreign', attrs: { lang: 'zh', textStyle: 'foreign' } }],
      }),
    );
    expect(html).toContain('大 | 乘');
    expect(html).not.toContain(UPRIGHT);
  });

  it('still escapes html in the surrounding text', () => {
    const html = render(
      para({
        type: 'text',
        text: '<b>&x</b> | y',
        marks: [{ type: 'italic' }],
      }),
    );
    expect(html).toContain(`&lt;b&gt;&amp;x&lt;/b&gt; ${UPRIGHT} y`);
  });
});
