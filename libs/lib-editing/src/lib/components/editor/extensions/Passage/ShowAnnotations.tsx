'use client';

import {
  DialogContent,
  DialogDescription,
  DialogTitle,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
} from '@eightyfourthousand/design-system';
import type { Editor } from '@tiptap/core';
import { useNavigation } from '../../../shared';
import { useEffect, useMemo, useState } from 'react';
import { Passage } from '@eightyfourthousand/data-access';
import { findPassageNode } from '../../util';

const CodeBlock = ({ code }: { code: string }) => {
  return (
    <div className="flex-1 overflow-auto rounded-md bg-muted p-4 font-mono text-sm">
      <pre className="whitespace-pre-wrap">
        <code className="language-json">{code}</code>
      </pre>
    </div>
  );
};

export const ShowAnnotations = ({
  editor,
  uuid,
  label,
  type,
}: {
  editor: Editor;
  uuid: string;
  label: string;
  type: string;
}) => {
  const [passage, setPassage] = useState<Passage>();
  const [toggleValue, setToggleValue] = useState<string[]>(['db', 'editor']);

  const { fetchPassage } = useNavigation();

  const nodeJson = useMemo(() => {
    const found = findPassageNode(editor, uuid);
    return found ? found.node.toJSON() : null;
  }, [editor, uuid]);

  useEffect(() => {
    if (passage) {
      return;
    }

    if (!uuid) {
      return;
    }

    (async () => {
      const fetchedPassage = await fetchPassage(uuid);
      setPassage(fetchedPassage);
    })();
  }, [uuid, passage, fetchPassage]);

  return (
    <DialogContent className="size-full flex flex-col gap-4 max-h-[calc(100vh-2rem)]">
      <DialogTitle>Passage Details</DialogTitle>
      <DialogDescription className="hidden">
        All annotations and metadata for this passage
      </DialogDescription>

      <div className="text-sm flex gap-1">
        <span className="text-primary">UUID: </span>
        <span>{uuid}</span>
        <span className="text-muted-foreground px-2">{'|'}</span>
        <span className="text-primary">Label:</span>
        <span>{label}</span>
        <span className="text-muted-foreground px-2">{'|'}</span>
        <span className="text-primary">Type:</span>
        <span>{type}</span>
      </div>

      <ToggleGroup
        type="multiple"
        variant="outline"
        defaultValue={['db', 'editor']}
        onValueChange={setToggleValue}
        className="mt-4"
      >
        <ToggleGroupItem value="db">Annotations</ToggleGroupItem>
        <ToggleGroupItem value="editor">Editor JSON</ToggleGroupItem>
      </ToggleGroup>

      <div className="flex gap-2 flex-1 min-h-0 overflow-auto">
        {toggleValue.includes('db') &&
          (passage ? (
            <CodeBlock code={JSON.stringify(passage.annotations, null, 2)} />
          ) : (
            <Skeleton className="size-full flex-1" />
          ))}

        {toggleValue.includes('editor') && (
          <CodeBlock code={JSON.stringify(nodeJson, null, 2)} />
        )}
      </div>
    </DialogContent>
  );
};
