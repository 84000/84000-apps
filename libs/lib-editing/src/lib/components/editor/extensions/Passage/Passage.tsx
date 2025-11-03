import { cn } from '@lib-utils';
import type { NodeViewProps } from '@tiptap/react';
import { NodeWrapper } from '../NodeWrapper';
import {
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@design-system';
import { EditorOptions } from './EditorOptions';
import { ReaderOptions } from './ReaderOptions';
import { useState } from 'react';
import { EditLabel } from './EditLabel';
import { ShowAnnotations } from './ShowAnnotations';

export const Passage = (props: NodeViewProps) => {
  const { node, editor } = props;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<string>();

  const className =
    'absolute labeled -left-16 w-16 text-end hover:cursor-pointer';
  const borderClassName =
    editor.storage.globalConfig.debug && node.attrs.invalid
      ? 'after:content-["⚠️"] after:absolute after:top-0 after:-right-5'
      : '';
  return (
    <NodeWrapper
      className={cn('relative ml-6 scroll-m-20', borderClassName)}
      innerClassName="passage is-editable pl-6"
      {...props}
    >
      <DropdownMenu>
        <DropdownMenuTrigger className={className} contentEditable={false}>
          {node.attrs.label || ''}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" alignOffset={48} className="w-64">
          {editor.isEditable ? (
            <EditorOptions
              onSelection={(item) => {
                setDialogType(item);
                setIsDialogOpen(true);
              }}
            />
          ) : (
            <ReaderOptions {...props} />
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {editor.isEditable && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          {dialogType === 'label' && (
            <EditLabel {...props} close={() => setIsDialogOpen(false)} />
          )}
          {dialogType === 'attributes' && <ShowAnnotations {...props} />}
        </Dialog>
      )}
    </NodeWrapper>
  );
};

export default Passage;
