import { escapeScriptClose, selfContainedProblems } from './self-contained';

const font = "@font-face{src:url('data:font/woff2;base64,AAAA')}";
const page = ({ head = '', css = font, js = 'run()' } = {}) =>
  `<html><head>${head}<style>${css}</style><script type="module">${js}</script></head><body></body></html>`;

describe('escapeScriptClose', () => {
  it('escapes </script in any case', () => {
    expect(escapeScriptClose('a("</script>", "</SCRIPT >")')).toBe(
      'a("<\\/script>", "<\\/SCRIPT >")',
    );
  });
});

describe('selfContainedProblems', () => {
  it('accepts an inlined page', () => {
    expect(selfContainedProblems(page())).toEqual([]);
  });

  it.each([
    [
      'an unescaped </SCRIPT',
      page({ js: 'x("</SCRIPT>")' }),
      'one inlined script',
    ],
    [
      'an escaped one, once fixed',
      page({ js: escapeScriptClose('x("</SCRIPT>")') }),
      undefined,
    ],
    [
      'a <script> string inside the JS, as React DOM ships',
      page({ js: escapeScriptClose('x("<script></script>")') }),
      undefined,
    ],
    [
      'a second script tag',
      `${page()}<script>y()</script>`,
      'one inlined script',
    ],
    ['a <link>', page({ head: '<link rel="stylesheet">' }), 'a <link>'],
    [
      'a remote url()',
      page({ css: `${font} a{background:url(https://x/y.png)}` }),
      'the CSS loads https://x/y.png',
    ],
    ['an @import', page({ css: `@import "x.css"; ${font}` }), 'an @import'],
    ['a missing font', page({ css: 'a{color:red}' }), 'Monlam font'],
  ])('flags %s', (_case, html, problem) => {
    const problems = selfContainedProblems(html);
    if (problem) expect(problems.join('; ')).toContain(problem);
    else expect(problems).toEqual([]);
  });
});
