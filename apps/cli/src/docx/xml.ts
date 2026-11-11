/** An XML element. Attribute and element names keep their prefixes. */
export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}

export type XmlNode = XmlElement | string;

const ENTITIES: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
};

function decode(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, ref) => {
    if (ref[0] !== '#') return ENTITIES[ref] ?? whole;
    const code =
      ref[1] === 'x' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
    return String.fromCodePoint(code);
  });
}

function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  for (const m of source.matchAll(pattern))
    attrs[m[1]] = decode(m[3] ?? m[4] ?? '');
  return attrs;
}

/** Find the `>` that closes a tag, skipping quoted attribute values. */
function tagEnd(xml: string, from: number): number {
  let quote = '';
  for (let i = from; i < xml.length; i++) {
    const c = xml[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '>') return i;
  }
  throw new Error('Malformed XML: unclosed tag.');
}

/** Parse an XML document to its root element. Text is kept exactly. */
export function parseXml(xml: string): XmlElement {
  const root: XmlElement = { name: '#document', attrs: {}, children: [] };
  const stack: XmlElement[] = [root];
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    const textEnd = lt < 0 ? xml.length : lt;
    if (textEnd > i)
      stack[stack.length - 1].children.push(decode(xml.slice(i, textEnd)));
    if (lt < 0) break;
    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt);
      if (end < 0) throw new Error('Malformed XML: unclosed comment.');
      i = end + 3;
    } else if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt);
      if (end < 0) throw new Error('Malformed XML: unclosed CDATA.');
      stack[stack.length - 1].children.push(xml.slice(lt + 9, end));
      i = end + 3;
    } else if (xml[lt + 1] === '?' || xml[lt + 1] === '!') {
      i = tagEnd(xml, lt) + 1;
    } else if (xml[lt + 1] === '/') {
      const end = tagEnd(xml, lt);
      const name = xml.slice(lt + 2, end).trim();
      const open = stack.pop();
      if (!open || open.name !== name)
        throw new Error(
          `Malformed XML: </${name}> does not close <${open?.name}>.`,
        );
      i = end + 1;
    } else {
      const end = tagEnd(xml, lt);
      const selfClosing = xml[end - 1] === '/';
      const body = xml.slice(lt + 1, selfClosing ? end - 1 : end);
      const space = body.search(/\s/);
      const name = space < 0 ? body : body.slice(0, space);
      const element: XmlElement = {
        name,
        attrs: space < 0 ? {} : parseAttrs(body.slice(space)),
        children: [],
      };
      stack[stack.length - 1].children.push(element);
      if (!selfClosing) stack.push(element);
      i = end + 1;
    }
  }
  if (stack.length !== 1)
    throw new Error(
      `Malformed XML: <${stack[stack.length - 1].name}> is not closed.`,
    );
  const element = root.children.find(
    (c): c is XmlElement => typeof c !== 'string',
  );
  if (!element) throw new Error('Malformed XML: no root element.');
  return element;
}

/** Child elements of `el`, optionally only those named `name`. */
export function elements(el: XmlElement, name?: string): XmlElement[] {
  return el.children.filter(
    (c): c is XmlElement => typeof c !== 'string' && (!name || c.name === name),
  );
}

/** The concatenated text children of `el`. */
export function textOf(el: XmlElement): string {
  return el.children.filter((c): c is string => typeof c === 'string').join('');
}
