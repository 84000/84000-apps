import { cn } from '@lib-utils';
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from '@tiptap/react';
import {
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@design-system';
import { EditorOptions } from './EditorOptions';
import { ReaderOptions } from './ReaderOptions';
import { memo, useEffect, useState } from 'react';
import { EditLabel } from './EditLabel';
import { ShowAnnotations } from './ShowAnnotations';
import { LabeledElement, useNavigation } from '../../../shared';
import { Alignment } from '@data-access';

const PassageComponent = (props: NodeViewProps) => {
  const { node, editor } = props;

  const [compareLeadingSpace, setCompareLeadingSpace] = useState('md:mt-1');
  const [isCompare, setIsCompare] = useState(false);
  const [source, setSource] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<string>();

  const { panels, toh } = useNavigation();

  useEffect(() => {
    const isCompare = panels.main.open && panels.main.tab === 'compare';
    setIsCompare(isCompare);
  }, [panels.main.open, panels.main.tab]);

  useEffect(() => {
    if (!isCompare || !toh) {
      setSource('');
      return;
    }

    const alignment = node.attrs.alignments?.[toh] as Alignment;
    setSource(alignment?.tibetan || '');
    const firstChild = node.content.firstChild;
    if (firstChild?.attrs.hasLeadingSpace) {
      setCompareLeadingSpace('md:mt-5');
    } else if (['lineGroup', 'list'].includes(firstChild?.type.name || '')) {
      setCompareLeadingSpace('md:mt-2');
    }
  }, [isCompare, node, toh]);

  const className =
    'absolute labeled -left-16 w-16 text-end hover:cursor-pointer -mt-0.25';
  const borderClassName =
    editor.storage.globalConfig.debug && node.attrs.invalid
      ? 'after:content-["⚠️"] after:absolute after:top-0 after:-right-5'
      : '';

  return (
    <NodeViewWrapper
      id={node.attrs.uuid}
      as="div"
      className={cn(
        'flex md:flex-row flex-col w-full md:gap-10 gap-2 scroll-mt-20',
        node.attrs.toh,
      )}
    >
      <div className="w-full">
        <div
          className={cn(
            'relative scroll-m-20 w-full self-start',
            borderClassName,
          )}
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
                <ReaderOptions
                  {...props}
                  contentType={source ? 'compare' : node.attrs.type}
                />
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <NodeViewContent className="passage is-editable pl-6 @c/sidebar:pl-4" />
          {editor.isEditable && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              {dialogType === 'label' && (
                <EditLabel {...props} close={() => setIsDialogOpen(false)} />
              )}
              {dialogType === 'attributes' && <ShowAnnotations {...props} />}
            </Dialog>
          )}
        </div>
      </div>
      <div
        className={cn('w-full', source ? '' : 'hidden', compareLeadingSpace)}
      >
        <LabeledElement label={node.attrs.label} className="mt-0.5">
          <div className="leading-7 font-tibetan text-lg whitespace-normal mt-1.5 pb-4 md:pb-2">
            {source}
          </div>
        </LabeledElement>
      </div>
    </NodeViewWrapper>
  );
};

export const Passage = memo(PassageComponent);

export default Passage;
