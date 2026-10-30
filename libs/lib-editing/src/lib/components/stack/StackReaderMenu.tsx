'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  useBookmark,
  type PanelContentType,
} from '@eightyfourthousand/data-access';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@eightyfourthousand/design-system';
import { cn } from '@eightyfourthousand/lib-utils';

import { ReaderOptions } from '../editor/extensions/Passage/ReaderOptions';
import { useNavigation } from '../shared/NavigationContext';
import { SuggestRevisionForm } from '../shared/SuggestRevisionForm';
import type { StackController } from './StackController';
import type { StackPassageMenuTarget } from './StackPassageMenu';

/** Characters of a passage kept with its bookmark. */
const EXCERPT_LENGTH = 100;

/**
 * The passage label menu of a read-only stack: bookmark, copy link and suggest
 * revision, as the paginated reader offers. Mounted once for the whole stack.
 */
export const StackReaderMenu = ({
  controller,
  target,
  onClose,
}: {
  controller: StackController;
  target: StackPassageMenuTarget | null;
  onClose: () => void;
}) => {
  // The passage whose revision form is showing, so another label opens on
  // the menu rather than on a form for a different passage.
  const [revisionFor, setRevisionFor] = useState<string | null>(null);
  const { toh, panels, imprint } = useNavigation();

  const meta = target ? controller.getMeta(target.uuid) : null;
  const uuid = meta?.uuid ?? '';
  const showRevisionForm = !!uuid && revisionFor === uuid;
  const text = controller.getRowText(uuid);
  const excerpt =
    text.slice(0, EXCERPT_LENGTH) + (text.length > EXCERPT_LENGTH ? '...' : '');
  const isCompare = panels.main.open && panels.main.tab === 'compare';
  const contentType = (
    isCompare && controller.getTibetan(uuid, toh) ? 'compare' : meta?.type
  ) as PanelContentType;

  const { isBookmarked, toggle } = useBookmark(uuid, {
    type: 'passage',
    subType: meta?.type,
    tab: meta?.type ?? '',
    label: meta?.label,
    body: excerpt,
    workTitle: imprint?.mainTitles?.en ?? toh,
    toh,
  });

  const toggleBookmark = useCallback(() => {
    toggle();
    // The row's indicator reads the bookmark store through the controller.
    controller.refreshBookmarks();
  }, [toggle, controller]);

  // Every way of closing goes through here, so a reopened menu starts on its
  // options rather than on a form left open.
  const close = useCallback(() => {
    setRevisionFor(null);
    onClose();
  }, [onClose]);

  // The captured rect goes stale on scroll, so close rather than drift.
  useEffect(() => {
    if (!target) return;
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [target, close]);

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next) close();
    },
    [close],
  );

  const rect = target?.rect;

  return (
    <DropdownMenu modal={false} open={!!meta} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          style={{
            position: 'fixed',
            left: rect?.left ?? 0,
            top: rect?.top ?? 0,
            width: rect?.width ?? 0,
            height: rect?.height ?? 0,
            pointerEvents: 'none',
          }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        alignOffset={48}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className={cn(showRevisionForm ? 'w-80' : 'w-64')}
      >
        {meta &&
          (showRevisionForm ? (
            <SuggestRevisionForm
              toh={toh ?? ''}
              type="passage"
              label={meta.label}
              onClose={close}
            />
          ) : (
            <ReaderOptions
              uuid={meta.uuid}
              contentType={contentType}
              isBookmarked={isBookmarked}
              toggleBookmark={toggleBookmark}
              onSuggestRevision={() => setRevisionFor(meta.uuid)}
            />
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
