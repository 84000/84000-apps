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
import { useEffect, useState } from 'react';
import { EditLabel } from './EditLabel';
import { ShowAnnotations } from './ShowAnnotations';
import { LabeledElement, useNavigation } from '../../../shared';
import { Alignment } from '@data-access';

export const Passage = (props: NodeViewProps) => {
  const { node, editor } = props;

  const [isCompare, setIsCompare] = useState(false);
  const [source, setSource] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<string>();

  const { panels, toh } = useNavigation();

  useEffect(() => {
    const isCompare = panels.main.open && panels.main.tab === 'compare';
    setIsCompare(isCompare);
  }, [panels, editor]);

  useEffect(() => {
    if (!isCompare || !toh) {
      setSource('');
      return;
    }

    const alignment = node.attrs.alignments?.[toh] as Alignment;
    setSource(alignment?.tibetan || '');
  }, [isCompare, node, toh]);

  const className =
    'absolute labeled -left-16 w-16 text-end hover:cursor-pointer';
  const borderClassName =
    editor.storage.globalConfig.debug && node.attrs.invalid
      ? 'after:content-["⚠️"] after:absolute after:top-0 after:-right-5'
      : '';

  return (
    <div className="flex w-full gap-16">
      <div className="w-full">
        <NodeWrapper
          className={cn(
            'relative ml-6 scroll-m-20 w-full self-start',
            borderClassName,
          )}
          innerClassName="passage is-editable pl-6"
          {...props}
        >
          <DropdownMenu>
            <DropdownMenuTrigger className={className} contentEditable={false}>
              {node.attrs.label || ''}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              alignOffset={48}
              className="w-64"
            >
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
      </div>
      <div className={cn('w-full mt-1', source ? '' : 'hidden')}>
        <LabeledElement label={node.attrs.label} className="mt-1">
          <div className="leading-8 text-lg whitespace-normal">{source}</div>
        </LabeledElement>
      </div>
    </div>
  );
};

export default Passage;
