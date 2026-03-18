import { cn } from '@lib-utils';
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from '@tiptap/react';
import {
  Button,
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@design-system';
import { EditorOptions } from './EditorOptions';
import { ReaderOptions } from './ReaderOptions';
import { memo, useCallback, useMemo, useState } from 'react';
import { EditLabel } from './EditLabel';
import { ShowAnnotations } from './ShowAnnotations';
import {
  LabeledElement,
  useNavigation,
  SuggestRevisionForm,
  PANEL_FOR_SECTION,
  TAB_FOR_SECTION,
} from '../../../shared';
import { Alignment, useBookmark } from '@data-access';
import { BookmarkIcon } from 'lucide-react';

const PassageComponent = (props: NodeViewProps) => {
  const { node, editor } = props;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<string>();
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { isBookmarked, toggle: toggleBookmark } = useBookmark(
    node.attrs.uuid,
    { type: 'passage', subType: node.attrs.type, tab: node.attrs.type ?? '' },
  );

  const { panels, toh, updatePanel } = useNavigation();

  // Compute values directly instead of using effects to avoid re-render loops
  const isCompare = panels.main.open && panels.main.tab === 'compare';

  const { source, compareLeadingSpace } = useMemo(() => {
    if (!isCompare || !toh) {
      return { source: '', compareLeadingSpace: 'md:mt-1' };
    }

    const alignment = node.attrs.alignments?.[toh] as Alignment;
    const source = alignment?.tibetan || '';

    const firstChild = node.content.firstChild;
    let compareLeadingSpace = 'md:mt-1';
    if (firstChild?.attrs.hasLeadingSpace) {
      compareLeadingSpace = 'md:mt-5';
    } else if (['lineGroup', 'list'].includes(firstChild?.type.name || '')) {
      compareLeadingSpace = 'md:mt-2';
    }

    return { source, compareLeadingSpace };
  }, [isCompare, toh, node.attrs.alignments, node.content.firstChild]);

  const references = node.attrs.references as
    | { uuid: string; label: string | null; sort: number; type: string }[]
    | undefined;

  const handleReferenceClick = useCallback(
    (passage: { uuid: string; type: string }) => {
      updatePanel({
        name: PANEL_FOR_SECTION[passage.type] || 'main',
        state: {
          open: true,
          tab: TAB_FOR_SECTION[passage.type] || 'translation',
          hash: passage.uuid,
        },
      });
    },
    [updatePanel],
  );

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
          <DropdownMenu
            open={dropdownOpen}
            onOpenChange={(open) => {
              setDropdownOpen(open);
              if (!open) setShowRevisionForm(false);
            }}
          >
            {!editor.isEditable && isBookmarked && (
              <div className="absolute -left-15.75 top-6 w-16 flex justify-end">
                <BookmarkIcon
                  className="text-accent size-3"
                  fill="currentColor"
                />
              </div>
            )}
            <DropdownMenuTrigger className={className} contentEditable={false}>
              {node.attrs.label || ''}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              alignOffset={48}
              className={cn(showRevisionForm ? 'w-80' : 'w-64')}
            >
              {showRevisionForm ? (
                <SuggestRevisionForm
                  toh={toh ?? ''}
                  type={'passage'}
                  label={node.attrs.label ?? ''}
                  onClose={() => {
                    setShowRevisionForm(false);
                    setDropdownOpen(false);
                  }}
                />
              ) : editor.isEditable ? (
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
                  isBookmarked={isBookmarked}
                  toggleBookmark={toggleBookmark}
                  onSuggestRevision={() => setShowRevisionForm(true)}
                />
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <NodeViewContent className="passage is-editable pl-6 @c/sidebar:pl-4" />
          {references && references.length > 0 && (
            <div className="pl-6 @c/sidebar:pl-4 mt-1" contentEditable={false}>
              {references.map((ref, index) => (
                <span key={ref.uuid}>
                  {index > 0 && ', '}
                  <Button
                    variant="link"
                    className="p-0 h-6 font-normal hover:cursor-pointer"
                    onClick={() => handleReferenceClick(ref)}
                  >
                    {ref.label || ref.uuid.slice(0, 6)}
                  </Button>
                </span>
              ))}
            </div>
          )}
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
