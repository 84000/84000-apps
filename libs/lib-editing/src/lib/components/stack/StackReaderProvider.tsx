'use client';

import { useState, type ReactNode } from 'react';

import { StackController } from './StackController';
import {
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
 */
export const StackReaderProvider = ({
  workUuid,
  children,
}: {
  workUuid: string;
  children: ReactNode;
}) => {
  const [stack, setStack] = useState<LoadedStackWork | null>(null);
  useStackWorkLoad({
    workUuid,
    readOnly: true,
    stack,
    setStack,
    createView: createReaderView,
  });
  return (
    <StackWorkContextProvider stack={stack} readOnly>
      {children}
    </StackWorkContextProvider>
  );
};
