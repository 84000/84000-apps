import type { JSONContent } from '@tiptap/core';
import type { GraphQLClient } from 'graphql-request';
import { getTranslationBlocks } from '@eightyfourthousand/client-graphql';
import { escapeHtml } from '@eightyfourthousand/lib-utils';

import { renderTranslationHTML } from '../reader/translation-html';
import { extractPlainText } from '../reader/ssr-text-fallback';

/** The server caps a passage page at 100. */
const MAX_PAGE = 100;

/** A passage's content as a document, whichever shape it was given in. */
const docOf = (content: JSONContent | JSONContent[]): JSONContent => {
  if (Array.isArray(content)) return { type: 'doc', content };
  if (content.type === 'doc') return content;
  // The passage node the API serves: its children are the passage.
  if (content.type === 'passage') {
    return { type: 'doc', content: content.content ?? [] };
  }
  return { type: 'doc', content: [content] };
};

/**
 * The read-only HTML a static stack row draws for a passage.
 *
 * Takes the passage node the API serves as `json`, or the passage's blocks.
 * Falls back to the passage's plain text when the content cannot be rendered.
 */
export const renderStaticPassageHTML = (
  content: JSONContent | JSONContent[],
): string => {
  const doc = docOf(content);
  return (
    renderTranslationHTML({ content: doc }) ??
    `<p>${escapeHtml(extractPlainText(doc))}</p>`
  );
};

/**
 * Read passages of one work and render each to static HTML, keyed by uuid.
 * Passages that cannot be read are missing from the result.
 */
export const loadStaticPassages = async ({
  client,
  workUuid,
  uuids,
}: {
  client: GraphQLClient;
  workUuid: string;
  uuids: string[];
}): Promise<Map<string, string>> => {
  const html = new Map<string, string>();
  const wanted = [...new Set(uuids)];
  const pages: string[][] = [];
  for (let i = 0; i < wanted.length; i += MAX_PAGE) {
    pages.push(wanted.slice(i, i + MAX_PAGE));
  }
  const results = await Promise.all(
    pages.map((page) =>
      getTranslationBlocks({
        client,
        uuid: workUuid,
        uuids: page,
        maxPassages: page.length,
      }),
    ),
  );
  results.forEach(({ blocks }) =>
    blocks.forEach((block: JSONContent) => {
      const uuid = block.attrs?.uuid as string | undefined;
      if (uuid) html.set(uuid, renderStaticPassageHTML(block));
    }),
  );
  return html;
};
