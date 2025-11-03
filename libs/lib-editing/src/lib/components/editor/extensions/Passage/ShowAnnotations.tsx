import {
  DialogContent,
  DialogDescription,
  DialogTitle,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
} from '@design-system';
import { NodeViewProps } from '@tiptap/react';
import { useNavigation } from '../../../shared';
import { useEffect, useState } from 'react';
import { Passage } from '@data-access';

const CodeBlock = ({ code }: { code: string }) => {
  return (
    <div className="flex-1 overflow-auto rounded-md bg-muted p-4 font-mono text-sm">
      <pre className="whitespace-pre-wrap">
        <code className="language-json">{code}</code>
      </pre>
    </div>
  );
};

export const ShowAnnotations = (props: NodeViewProps) => {
  const [passage, setPassage] = useState<Passage>();
  const [toggleValue, setToggleValue] = useState<string[]>(['db', 'editor']);

  const { node } = props;
  const { fetchPassage } = useNavigation();

  useEffect(() => {
    if (passage) {
      return;
    }

    const uuid = node.attrs.uuid;
    if (!uuid) {
      return;
    }

    (async () => {
      const fetchedPassage = await fetchPassage(uuid);
      console.log('Fetched passage:', fetchedPassage);
      setPassage(fetchedPassage);
    })();
  }, [node, passage, fetchPassage]);

  return (
    <DialogContent className="size-full flex flex-col gap-4 max-h-[calc(100vh-2rem)]">
      <DialogTitle>Passage Details</DialogTitle>
      <DialogDescription className="hidden">
        All annotations and metadata for this passage
      </DialogDescription>

      <div className="text-sm flex gap-1">
        <span className="text-navy">UUID: </span>
        <span>{node.attrs.uuid}</span>
        <span className="text-muted-foreground px-2">{'|'}</span>
        <span className="text-navy">Label:</span>
        <span>{node.attrs.label}</span>
        <span className="text-muted-foreground px-2">{'|'}</span>
        <span className="text-navy">Type:</span>
        <span>{node.attrs.type}</span>
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
          <CodeBlock code={JSON.stringify(node, null, 2)} />
        )}
      </div>
    </DialogContent>
  );
};
