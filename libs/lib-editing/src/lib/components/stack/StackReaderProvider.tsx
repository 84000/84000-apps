'use client';

import { useState, type ReactNode } from 'react';

import { StackController } from './StackController';
import type { StackReaderSeed } from './stack-seed';
import {
  seedStackWork,
  StackWorkContextProvider,
  useStackWorkLoad,
  type LoadedStackWork,
  type StackViewFactory,
} from './stack-work-context';

const createReaderView: StackViewFactory = (options) =>
  new StackController(options);

/**
 * A work's stacks for reading: `StackWorkProvider` without the editor.
 *
 * Every view is read-only and none can mount an editor, so nothing under it
 * loads the editing layer, `EditorProvider` included.
 *
 * Given a `seed` (`loadStackReaderSeed`, on the server), the stacks exist from
 * the first render, so a server draws their first rows and the browser keeps
 * them. Without one they load in the browser.
 */
export const StackReaderProvider = ({
  workUuid,
  seed,
  children,
}: {
  workUuid: string;
  seed?: StackReaderSeed;
  children: ReactNode;
}) => {
  const [stack, setStack] = useState<LoadedStackWork | null>(() =>
    seed?.workUuid === workUuid
      ? seedStackWork({ seed, readOnly: true, createView: createReaderView })
      : null,
  );
  useStackWorkLoad({
    workUuid,
    readOnly: true,
    stack,
    setStack,
    createView: createReaderView,
    seed,
  });
  return (
    <StackWorkContextProvider stack={stack} readOnly>
      {children}
    </StackWorkContextProvider>
  );
};
