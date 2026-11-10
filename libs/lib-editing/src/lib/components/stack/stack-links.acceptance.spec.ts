/**
 * ED-1647 acceptance: in the stack reader, a same-work mention targeting an
 * endnote opens the right panel's endnotes tab on that note, including when
 * the note belongs to another Toh of the same work (criterion 3).
 *
 * The anchor is produced by the real mention SSR renderer, so this checks the
 * renderer/resolver contract end to end.
 */
import { getSchema, Node } from '@tiptap/core';
import { DOMSerializer } from '@tiptap/pm/model';
import {
  MentionSSR,
  mentionDOMOutputSpec,
  type MentionItem,
} from '../editor/extensions/Mention/Mention.ssr';
import { resolveStackLink } from './stack-links';

const Document = Node.create({
  name: 'doc',
  topNode: true,
  content: 'paragraph+',
});
const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
});
const Text = Node.create({ name: 'text', group: 'inline' });
const schema = getSchema([Document, Paragraph, Text, MentionSSR]);

/** Render a mention item to the static HTML a reader row would contain. */
const renderAnchor = (item: Partial<MentionItem>) => {
  const node = schema.nodes['mention'].create({
    items: [
      {
        uuid: 'm-1',
        entity: 'note-uuid',
        linkType: 'passage',
        displayText: 'n.5',
        isSameWork: true,
        ...item,
      },
    ],
  });
  document.body.innerHTML = '';
  const { dom } = DOMSerializer.renderSpec(
    document,
    mentionDOMOutputSpec(node),
  );
  document.body.appendChild(dom);
  const anchor = document.querySelector('a.mention-link');
  if (!anchor) throw new Error('mention rendered no anchor');
  return anchor;
};

describe('resolveStackLink on a same-work endnote mention (ED-1647)', () => {
  it('criterion 3: opens the right panel endnotes tab on the note', () => {
    expect(
      resolveStackLink(renderAnchor({ subtype: 'endnotes' })),
    ).toMatchObject({
      kind: 'panel',
      panel: 'right',
      tab: 'endnotes',
      hash: 'note-uuid',
    });
  });

  it('criterion 3: carries the Toh of a note in another Toh of the work', () => {
    expect(
      resolveStackLink(renderAnchor({ subtype: 'endnotes', linkToh: 'toh2' })),
    ).toMatchObject({
      kind: 'panel',
      panel: 'right',
      tab: 'endnotes',
      hash: 'note-uuid',
      toh: 'toh2',
    });
  });

  it('criterion 4: glossary, bibliography and folio mentions resolve as before', () => {
    expect(
      resolveStackLink(renderAnchor({ linkType: 'glossary', entity: 'g-1' })),
    ).toMatchObject({ panel: 'right', tab: 'glossary', hash: 'g-1' });
    expect(
      resolveStackLink(
        renderAnchor({ linkType: 'bibliography', entity: 'b-1' }),
      ),
    ).toMatchObject({ panel: 'right', tab: 'bibliography', hash: 'b-1' });
    expect(
      resolveStackLink(renderAnchor({ linkType: 'folio', entity: 'f-1' })),
    ).toMatchObject({ panel: 'main', tab: 'source', hash: 'f-1' });
  });
});
