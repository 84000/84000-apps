import { renderTranslationHTML } from './translation-html';

describe('renderTranslationHTML', () => {
  it('closes a leaf element that is not void, so the text after it stays visible', () => {
    const html = renderTranslationHTML({
      content: [
        { type: 'audio', attrs: { src: 'https://example.com/a.mp3' } },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'After the audio' }],
        },
      ],
    });

    const body = new DOMParser().parseFromString(html ?? '', 'text/html').body;
    const audio = body.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio?.childNodes).toHaveLength(0);
    expect(body.querySelector('p')?.textContent).toBe('After the audio');
    expect(body.querySelector('audio p')).toBeNull();
  });

  it('leaves void elements self-closed', () => {
    const html = renderTranslationHTML({
      content: [
        { type: 'image', attrs: { src: 'https://example.com/a.png' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'a/>b' }] },
      ],
    });

    expect(html).toMatch(/<img[^>]*\/>/);
    expect(html).not.toContain('</img>');
    expect(html).toContain('a/&gt;b');
  });
});
