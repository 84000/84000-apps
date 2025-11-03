import { DialogContent, DialogDescription, DialogTitle } from '@design-system';
import { NodeViewProps } from '@tiptap/react';

export const ShowAnnotations = (props: NodeViewProps) => {
  return (
    <DialogContent className="md:max-w-2xl">
      <DialogTitle>Passage Details</DialogTitle>
      <DialogDescription>
        All annotations and metadata for this passage
      </DialogDescription>
      <div className="mt-4 max-h-96 overflow-auto rounded-md bg-muted p-4 font-mono text-sm">
        <pre className="whitespace-pre-wrap">
          <code className="language-json">
            {JSON.stringify(props.node.toJSON(), null, 2)}
          </code>
        </pre>
      </div>
    </DialogContent>
  );
};
