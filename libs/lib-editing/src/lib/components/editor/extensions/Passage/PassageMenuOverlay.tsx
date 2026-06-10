'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/core';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@eightyfourthousand/design-system';
import { cn } from '@eightyfourthousand/lib-utils';
import {
  getBookmarks,
  type PanelContentType,
  useBookmark,
} from '@eightyfourthousand/data-access';
import {
  PANEL_FOR_SECTION,
  SuggestRevisionForm,
  TAB_FOR_SECTION,
  useNavigation,
} from '../../../shared';
import { EditorOptions } from './EditorOptions';
import { ReaderOptions } from './ReaderOptions';
import { EditLabel } from './EditLabel';
import { ShowAnnotations } from './ShowAnnotations';
import { deleteEndnotePassageNode } from '../EndNoteLink/endnote-utils';
import { findPassageNode } from '../../util';
import type { PassageMenuPayload } from './PassageNode';

type MenuState = { uuid: string; rect: PassageMenuPayload['rect'] };

/**
 * A single, stable React layer (mounted as a sibling of EditorContent) that
 * renders the passage label dropdown menu and its dialogs. Because it lives
 * outside the per-passage node view, ProseMirror never remounts it, so the
 * menu/dialog state survives editor transactions — the fix for the previous
 * NodeView remount churn. It also feeds navigation-derived state into the
 * PassageNode view plugin so the compare-source and bookmark chrome stay in sync.
 */
export const PassageMenuOverlay = ({ editor }: { editor: Editor }) => {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [open, setOpen] = useState(false);
  const [dialogType, setDialogType] = useState<string>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [bookmarkVersion, setBookmarkVersion] = useState(0);

  const { toh, panels, updatePanel, imprint } = useNavigation();
  const isCompare = panels.main.open && panels.main.tab === 'compare';

  // Resolve the clicked passage's attributes + excerpt from the document.
  const passage = useMemo(() => {
    if (!menu) return null;
    const found = findPassageNode(editor, menu.uuid);
    if (!found) return null;
    const text = (found.node.textContent as string) || '';
    return {
      uuid: menu.uuid,
      label: (found.node.attrs.label as string) || '',
      type: (found.node.attrs.type as string) || '',
      excerpt: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
      hasCompare: !!(found.node.attrs.alignments?.[toh ?? ''] as unknown),
    };
  }, [editor, menu, toh]);

  const contentType = (
    isCompare && passage?.hasCompare ? 'compare' : (passage?.type ?? '')
  ) as PanelContentType;

  const workTitle = imprint?.mainTitles?.en ?? toh;
  const { isBookmarked, toggle: toggleBookmark } = useBookmark(
    passage?.uuid ?? '',
    {
      type: 'passage',
      subType: passage?.type,
      tab: passage?.type ?? '',
      label: passage?.label,
      body: passage?.excerpt,
      workTitle,
      toh,
    },
  );

  // Register the openMenu / navigateRef callbacks the PassageNode click plugin
  // calls, plus clean them up on unmount.
  useEffect(() => {
    const storage = editor.storage.passage;
    if (!storage) return;
    storage.openMenu = (payload: PassageMenuPayload) => {
      setMenu({ uuid: payload.uuid, rect: payload.rect });
      setShowRevisionForm(false);
      setOpen(true);
    };
    storage.navigateRef = (ref) => {
      updatePanel({
        name: PANEL_FOR_SECTION[ref.type] || 'main',
        state: {
          open: true,
          tab: TAB_FOR_SECTION[ref.type] || 'translation',
          hash: ref.uuid,
        },
      });
    };
    return () => {
      storage.openMenu = undefined;
      storage.navigateRef = undefined;
    };
  }, [editor, updatePanel]);

  // Feed navigation + bookmark state to the view plugin that paints the
  // compare-source text and the reader bookmark icon.
  useEffect(() => {
    const storage = editor.storage.passage;
    if (!storage) return;
    storage.chrome = {
      toh,
      isCompare,
      bookmarkedUuids: new Set(getBookmarks().map((b) => b.uuid)),
    };
    storage.refreshChrome?.();
  }, [editor, toh, isCompare, bookmarkVersion]);

  // Keep the bookmark chrome fresh when bookmarks change in another tab.
  useEffect(() => {
    const onStorage = () => setBookmarkVersion((v) => v + 1);
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // The menu is anchored to a fixed-position trigger placed over the clicked
  // label; a captured rect goes stale on scroll, so close instead of drift.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const onMenuOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setShowRevisionForm(false);
  }, []);

  const handleToggleBookmark = useCallback(() => {
    toggleBookmark();
    setBookmarkVersion((v) => v + 1);
  }, [toggleBookmark]);

  const handleDelete = useCallback(() => {
    if (passage) deleteEndnotePassageNode(editor, passage.uuid);
    setIsDialogOpen(false);
  }, [editor, passage]);

  const rect = menu?.rect;

  return (
    <>
      <DropdownMenu modal={false} open={open} onOpenChange={onMenuOpenChange}>
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
          {passage &&
            (showRevisionForm ? (
              <SuggestRevisionForm
                toh={toh ?? ''}
                type={'passage'}
                label={passage.label}
                onClose={() => {
                  setShowRevisionForm(false);
                  setOpen(false);
                }}
              />
            ) : editor.isEditable ? (
              <EditorOptions
                uuid={passage.uuid}
                contentType={contentType}
                onSelection={(item) => {
                  setDialogType(item);
                  setIsDialogOpen(true);
                  setOpen(false);
                }}
              />
            ) : (
              <ReaderOptions
                uuid={passage.uuid}
                contentType={contentType}
                isBookmarked={isBookmarked}
                toggleBookmark={handleToggleBookmark}
                onSuggestRevision={() => setShowRevisionForm(true)}
              />
            ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {editor.isEditable && passage && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          {dialogType === 'label' && (
            <EditLabel
              editor={editor}
              uuid={passage.uuid}
              label={passage.label}
              close={() => setIsDialogOpen(false)}
            />
          )}
          {dialogType === 'attributes' && (
            <ShowAnnotations
              editor={editor}
              uuid={passage.uuid}
              label={passage.label}
              type={passage.type}
            />
          )}
          {dialogType === 'delete' && (
            <DialogContent
              className="max-w-readable w-full font-serif"
              showCloseButton={false}
            >
              <DialogHeader>
                <DialogTitle>Delete Passage</DialogTitle>
                <DialogDescription>
                  This will delete passage {passage.label}
                  {passage.type === 'endnotes' &&
                    ' and remove all links to it in the translation'}
                  . This action cannot be undone after saving.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      )}
    </>
  );
};

export default PassageMenuOverlay;
