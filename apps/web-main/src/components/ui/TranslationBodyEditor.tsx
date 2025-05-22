'use client';

import { Body } from '@data-access';
import { BlockEditor } from '@design-system';
import type { BlockEditorContent } from '@design-system';
import { blocksFromTranslationBody } from '@lib-editing';
import { useEffect, useState } from 'react';
import { useEditorState } from '../editor/EditorContext';
import { XmlFragment } from 'yjs';

export const TranslationBodyEditor = ({ body }: { body: Body }) => {
  const [content, setContent] = useState<BlockEditorContent>([]);
  const [dirtyUuids, setDirtyUuids] = useState<string[]>([]);
  const { doc } = useEditorState();
  const [editorDoc] = useState(doc());

  useEffect(() => {
    if (!editorDoc) {
      return;
    }

    editorDoc.getXmlFragment('default').observeDeep((evt, txn) => {
      if (!txn.local) {
        return;
      }

      const uuids: string[] = [];
      evt.forEach((item) => {
        const node: XmlFragment = (
          item.target instanceof XmlFragment ? item.target : item.target.parent
        )?.toDOM();

        if (!node || !(node instanceof HTMLElement)) {
          return;
        }

        const uuid = node.getAttribute('uuid');

        if (uuid) {
          console.log(item.changes);
          uuids.push(uuid);
        }
      });

      setDirtyUuids((prev) => {
        return [...new Set([...prev, ...uuids])];
      });
    });
  }, [editorDoc]);

  useEffect(() => {
    console.log(dirtyUuids);
  }, [dirtyUuids]);

  useEffect(() => {
    const blocks = blocksFromTranslationBody(body);
    setContent(blocks);
  }, [body]);

  return <BlockEditor content={content} doc={editorDoc} />;
};
