import type { JSONContent } from '@tiptap/core';
import { DOMParser } from '@tiptap/pm/model';

import { glossarySchema } from './glossary-codec';
import { plainPastedSlice } from './glossary-editor-extensions';

// See PassageStackController.spec.ts — building the schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const pasted = (html: string) => {
  const container = document.createElement('div');
  container.innerHTML = html;
  const slice = DOMParser.fromSchema(glossarySchema()).parseSlice(container);
  return plainPastedSlice(slice).content.toJSON() as JSONContent[];
};

const typesIn = (blocks: JSONContent[]) => {
  const types = new Set<string>();
  const walk = (node: JSONContent) => {
    types.add(node.type as string);
    node.marks?.forEach((mark) => types.add(mark.type as string));
    node.content?.forEach(walk);
  };
  blocks.forEach(walk);
  return types;
};

const storedIn = (blocks: JSONContent[]) =>
  JSON.stringify(blocks).match(/"stored":\{/g)?.length ?? 0;

describe('plainPastedSlice', () => {
  it('takes the text and the editor marks, not the stored markup', () => {
    const blocks = pasted(
      '<p class="definition">A <span data-glossary-id="x">god</span> <em class="foreign">of</em> <ptr target="#a"></ptr>the sky.</p>',
    );
    const types = typesIn(blocks);
    expect(types.has('definitionMarkup')).toBe(false);
    expect(types.has('definitionPointer')).toBe(false);
    expect(types.has('italic')).toBe(true);
    expect(storedIn(blocks)).toBe(0);
  });

  it('lifts paragraphs out of a pasted wrapper', () => {
    const blocks = pasted(
      '<note type="definition"><p>One.</p><p>Two.</p></note>',
    );
    expect(blocks.map((block) => block.type)).toEqual([
      'paragraph',
      'paragraph',
    ]);
  });

  it('pastes nothing for a lone pointer', () => {
    expect(pasted('<ptr target="#a"></ptr>')).toBeNull();
  });
});
