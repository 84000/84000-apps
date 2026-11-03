'use client';

import dynamic from 'next/dynamic';
import { ReactNode, use, useEffect, useState } from 'react';
import { EditorContextProvider, useEditorState } from './EditorProvider';
import {
  createGraphQLClient,
  getTranslationMetadataByUuid,
  Work,
} from '@eightyfourthousand/client-graphql';
import { ThreeColumnRenderer, TranslationSkeleton } from '../shared';
import {
  LeftPanel,
  MainPanel,
  MainPanelHeader,
  RightPanel,
} from '@eightyfourthousand/design-system';
import { EditorHeader } from './EditorHeader';

/**
 * Loaded on demand, and never on the server.
 *
 * The stack lives on its own subpath because its `@tiptap/y-tiptap` imports
 * crash `web-main`'s SSR module evaluation, and these pages are reached
 * through the main barrel. `ssr: false` is what keeps it out of the server
 * bundle — verified by grepping the built chunks, since the route is not
 * prerendered and a green build proves nothing.
 */
const StackWorkProvider = dynamic(
  () => import('../stack/StackWorkProvider').then((m) => m.StackWorkProvider),
  { ssr: false },
);

export const EditorLayout = ({
  left,
  main,
  right,
  params,
}: {
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = use(params);
  const [work, setWork] = useState<Work>();

  useEffect(() => {
    (async () => {
      const client = createGraphQLClient();
      const work = await getTranslationMetadataByUuid({
        client,
        uuid: slug,
      });
      if (work) {
        setWork(work);
      }
    })();
  }, [slug]);

  if (!work) {
    return <TranslationSkeleton />;
  }

  const columns = (
    <ThreeColumnRenderer withHeader={true}>
      <LeftPanel>{left}</LeftPanel>
      <MainPanelHeader>
        <EditorHeader />
      </MainPanelHeader>
      <MainPanel>{main}</MainPanel>
      <RightPanel>{right}</RightPanel>
    </ThreeColumnRenderer>
  );

  return (
    <EditorContextProvider work={work}>
      <EditorStack workUuid={work.uuid}>{columns}</EditorStack>
    </EditorContextProvider>
  );
};

/**
 * One work behind every column, so the tabs share a spine and an undo
 * history.
 *
 * Read-only follows the editor context, which also sets
 * `NavigationProvider`'s `editable` from it: the stack and the hover cards'
 * edit actions must agree on whether the work can be edited.
 */
const EditorStack = ({
  workUuid,
  children,
}: {
  workUuid: string;
  children: ReactNode;
}) => {
  const { readOnly } = useEditorState();
  return (
    <StackWorkProvider workUuid={workUuid} readOnly={readOnly}>
      {children}
    </StackWorkProvider>
  );
};
