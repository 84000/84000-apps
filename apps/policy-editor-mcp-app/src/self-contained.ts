// Build-time checks for `vite.config.mjs`; not part of the app bundle.

/** Escapes every `</script`, in any case, so inlined JS cannot end its tag. */
export const escapeScriptClose = (code: string) =>
  code.replace(/<\/(script)/gi, '<\\/$1');

/** Why `html` is not one self-contained document; empty when it is. */
export function selfContainedProblems(html: string): string[] {
  const problems: string[] = [];
  const opens = html.match(/<script\b/gi)?.length ?? 0;
  const closes = html.match(/<\/script/gi)?.length ?? 0;
  if (opens !== 1 || closes !== 1) {
    problems.push(
      `expected one inlined script, found ${opens} <script and ${closes} </script`,
    );
  }

  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  const css = styles.map((match) => match[1]).join('\n');
  const markup = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script></script>')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '<style></style>');

  if (/<link\b/i.test(markup)) problems.push('a <link> survived inlining');
  if (/\s(?:src|href|srcset|poster|action)\s*=/i.test(markup)) {
    problems.push('the markup references a URL');
  }
  for (const [, url] of css.matchAll(/url\(\s*['"]?([^'")\s]+)/gi)) {
    if (!url.startsWith('data:') && !url.startsWith('#')) {
      problems.push(`the CSS loads ${url}`);
    }
  }
  if (/@import\b/i.test(css)) problems.push('the CSS has an @import');
  if (!css.includes('data:font/woff2;base64,')) {
    problems.push('the Monlam font is not inlined');
  }
  return problems;
}
