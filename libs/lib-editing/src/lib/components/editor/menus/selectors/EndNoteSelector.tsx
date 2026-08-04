'use client';

import { cn } from '@eightyfourthousand/lib-utils';
import { Editor } from '@tiptap/core';
import { useEditorState as useTiptapEditorState } from '@tiptap/react';
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  toast,
} from '@eightyfourthousand/design-system';
import {
  AsteriskIcon,
  Loader2Icon,
  PlusIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { createGraphQLClient } from '@eightyfourthousand/client-graphql';
import { gql } from 'graphql-request';
import { useEditorState } from '../../EditorProvider';
import { useNavigation } from '../../../shared';
import {
  findLastEndNoteLinkBefore,
  findPassageNode,
  getFirstEndnoteInEditor,
  insertEndnotePassage,
  syncEndnoteLinkLabelsAcrossEditors,
  waitFor,
} from '../../extensions/EndNoteLink/endnote-utils';
import { incrementLabel } from '../../extensions/Passage/label';

const SEARCH_ENDNOTES = gql`
  query SearchEndnotes($uuid: ID!, $limit: Int, $filter: PassageFilter) {
    work(uuid: $uuid) {
      uuid
      passages(limit: $limit, filter: $filter) {
        nodes {
          uuid
          content
          label
          sort
        }
      }
    }
  }
`;

interface EndnoteResult {
  uuid: string;
  label: string | null;
  content: string;
  sort: number;
}

export const EndNoteSelector = ({ editor }: { editor: Editor }) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<EndnoteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  const { getEditor, isNavigating } = useEditorState();
  const { uuid: workUuid, updatePanel, fetchEndNote } = useNavigation();

  const editorState = useTiptapEditorState({
    editor,
    selector: (instance) => ({
      isActive: instance.editor.isActive('endNoteLink'),
    }),
  });

  const searchEndnotes = useCallback(
    async (query: string) => {
      if (!query.trim() || !workUuid) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const client = createGraphQLClient();

        // Normalize input: if just a number, prepend "n."
        let labelPattern = query.trim();
        if (/^\d+$/.test(labelPattern)) {
          labelPattern = `n.${labelPattern}`;
        }
        // Append % for ILIKE pattern matching
        if (!labelPattern.endsWith('%')) {
          labelPattern = `${labelPattern}%`;
        }

        const response = await client.request<{
          work: {
            passages: {
              nodes: Array<{
                uuid: string;
                content: string;
                label: string | null;
                sort: number;
              }>;
            };
          } | null;
        }>(SEARCH_ENDNOTES, {
          uuid: workUuid,
          limit: 20,
          filter: { types: ['endnotes'], label: labelPattern },
        });

        const nodes = response.work?.passages.nodes ?? [];
        setResults(
          nodes.map((n) => ({
            uuid: n.uuid,
            label: n.label ?? null,
            content: n.content,
            sort: n.sort,
          })),
        );
      } catch (err) {
        console.error('Error searching endnotes:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [workUuid],
  );

  // Clearing an emptied query happens during render. Non-empty queries keep
  // showing the previous results until the debounced search returns, as before.
  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);
  if (searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(searchQuery);
    if (!searchQuery.trim()) {
      setResults([]);
    }
  }

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!searchQuery.trim()) {
      return;
    }

    debounceRef.current = setTimeout(() => {
      searchEndnotes(searchQuery);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, searchEndnotes]);

  /** Close the popover and clear its search state. */
  const dismiss = useCallback(() => {
    setOpen(false);
    setSearchQuery('');
    setResults([]);
  }, []);

  const linkToExisting = useCallback(
    (endnoteUuid: string, endnoteLabel: string | null) => {
      const { to } = editor.state.selection;
      editor
        .chain()
        .focus()
        .setEndNoteLink(endnoteUuid, endnoteLabel ?? undefined)
        .setTextSelection(to)
        .run();
      dismiss();
    },
    [editor, dismiss],
  );

  const createNewEndnote = useCallback(async () => {
    const endnotesEditor = getEditor('endnotes');
    const { from, to } = editor.state.selection;
    const selectionIsRange = from !== to;

    /**
     * Give up rather than guess. The new note's position comes from a
     * neighbouring note fetched by uuid; when we cannot establish that
     * neighbour we have no way to know where the note belongs in the series,
     * and guessing from the loaded window yields a label that duplicates a
     * note further down — the DEV-720 failure.
     */
    const abort = (message: string) => {
      toast(message, {
        icon: <TriangleAlertIcon className="size-4 text-warning" />,
      });
      dismiss();
    };

    // Without an endnotes editor there is nothing to hold the new passage, so
    // the link would be saved pointing at a passage that never gets created.
    if (!endnotesEditor) {
      abort('Open the Notes panel to add an endnote.');
      return;
    }

    // Check for an existing endNoteLink mark at the end of the selection.
    // Only the end matters — the endnote superscript renders there.
    const nodeBeforeTo =
      selectionIsRange ? editor.state.doc.nodeAt(to - 1) : null;
    const endMark = nodeBeforeTo?.marks.find(
      (m) => m.type.name === 'endNoteLink',
    );
    const endNote =
      endMark &&
      (endMark.attrs.notes as { endNote: string }[] | undefined)?.find(
        (n) => n.endNote,
      );

    // Determine whether `to` is exactly at the end of the mark or in the middle.
    // nodeAt(to) returns the character after the selection — if it still carries
    // the same mark, `to` is in the middle and a split is needed.
    const markType = editor.state.schema.marks.endNoteLink;
    const nodeAtTo = endNote ? editor.state.doc.nodeAt(to) : null;
    const markContinues = nodeAtTo && markType.isInSet(nodeAtTo.marks);

    // Find the previous endnote link before cursor to determine insertion point
    const prevLink = findLastEndNoteLinkBefore(editor, from);

    let newLabel: string;
    let newSort: number;
    let afterPassageUuid: string | undefined;
    let beforePassageUuid: string | undefined;

    if (endNote && !markContinues) {
      // `to` is at the exact end of the mark — append a new note after
      // the last existing note's passage.
      const notes = endMark.attrs.notes as { endNote: string }[];
      const lastNote = notes[notes.length - 1];
      const passage = await fetchEndNote(lastNote.endNote);
      if (!passage) {
        abort('Could not read the neighbouring note. Try again.');
        return;
      }
      newLabel = incrementLabel(passage.label || 'n.0');
      newSort = passage.sort + 1;
      afterPassageUuid = passage.uuid;
    } else if (endNote && markContinues) {
      // `to` is in the middle of the mark — split. The new endnote takes
      // the existing passage's label and is inserted before it.
      const passage = await fetchEndNote(endNote.endNote);
      if (!passage) {
        abort('Could not read the neighbouring note. Try again.');
        return;
      }
      newLabel = passage.label || 'n.1';
      newSort = passage.sort;
      beforePassageUuid = passage.uuid;
    } else if (prevLink) {
      const passage = await fetchEndNote(prevLink.endNote);
      if (!passage) {
        abort('Could not read the preceding note. Try again.');
        return;
      }
      newLabel = incrementLabel(passage.label || 'n.0');
      newSort = passage.sort + 1;
      afterPassageUuid = passage.uuid;
    } else {
      // No endnote link precedes the cursor in the loaded translation window,
      // so this looks like the first note of the series. The translation editor
      // is paginated too, and "no link above the cursor" is only trustworthy
      // when the notes panel is showing the true start of the series — an
      // endnote labelled n.1. Otherwise notes may well precede this position
      // outside both windows, and inserting as n.1 would renumber the series
      // from the wrong end.
      const first = getFirstEndnoteInEditor(endnotesEditor);
      if (first && first.label !== 'n.1') {
        abort(
          'Jump to the note just before this position, then add the new note.',
        );
        return;
      }
      newLabel = 'n.1';
      newSort = first ? first.sort : 1;
      beforePassageUuid = first?.uuid;
    }

    // The endnotes panel holds a paginated window, not the whole series, so the
    // anchor may not be loaded — the case that made this fail on works with
    // more than a page of notes. Navigating the panel to the anchor loads the
    // window around it (and keeps the panel's pagination cursors coherent,
    // which fetching the blocks here would not).
    const anchorUuid = beforePassageUuid ?? afterPassageUuid;
    if (anchorUuid && !findPassageNode(endnotesEditor, anchorUuid)) {
      updatePanel({
        name: 'right',
        state: { open: true, tab: 'endnotes', hash: anchorUuid },
      });

      // Wait for the navigation to finish, not just for the anchor to appear.
      // Dirty tracking is suppressed for the duration of a navigation, so
      // editing inside that window would leave the new note unsaveable: the
      // Save button only appears once the document is dirty.
      const ready = await waitFor(
        () =>
          !isNavigating() && Boolean(findPassageNode(endnotesEditor, anchorUuid)),
      );

      if (!ready) {
        abort('Could not load the notes around this position. Try again.');
        return;
      }
    }

    const newPassageUuid = uuidv4();

    // Insert the passage before the link mark: if the insert is refused the
    // document is left untouched instead of carrying a link to a note that
    // does not exist.
    const inserted = insertEndnotePassage(endnotesEditor, {
      label: newLabel,
      sort: newSort,
      uuid: newPassageUuid,
      afterPassageUuid,
      beforePassageUuid,
    });

    if (!inserted) {
      abort('Could not place the new note in the series. Try again.');
      return;
    }

    // Insert endNoteLink mark in main editor with the label for immediate
    // display, then collapse the selection to dismiss the bubble menu. The
    // selection is restored explicitly because the awaits above give the
    // editor a chance to lose it.
    editor
      .chain()
      .focus()
      .setTextSelection(selectionIsRange ? { from, to } : to)
      .setEndNoteLink(newPassageUuid, newLabel)
      .setTextSelection(to)
      .run();

    // Sync updated labels into endNoteLink marks across front + translation
    syncEndnoteLinkLabelsAcrossEditors(endnotesEditor, getEditor);

    // Navigate to the new endnote
    updatePanel({
      name: 'right',
      state: { open: true, tab: 'endnotes', hash: newPassageUuid },
    });

    // Focus the new endnote passage after navigation
    setTimeout(() => {
      const found = findPassageNode(endnotesEditor, newPassageUuid);
      if (found) {
        endnotesEditor.commands.focus(found.pos + 2);
      }
    }, 200);

    dismiss();
  }, [editor, getEditor, fetchEndNote, updatePanel, dismiss, isNavigating]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-none flex-shrink-0"
        >
          <AsteriskIcon
            className={cn(
              'size-4',
              editorState.isActive ? 'text-primary' : 'text-muted-foreground',
            )}
            strokeWidth={2.5}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 shadow-xl rounded-md border p-2"
        align="end"
        noPortal
      >
        <div className="flex flex-col gap-2">
          <Input
            ref={inputRef}
            placeholder="Search endnotes by label..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-sm"
          />

          {loading && (
            <div className="flex items-center justify-center py-2">
              <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
              {results.map((result) => (
                <button
                  key={result.uuid}
                  className="flex items-start gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer text-left w-full"
                  onClick={() => linkToExisting(result.uuid, result.label)}
                >
                  <span className="font-medium text-primary shrink-0">
                    {result.label}
                  </span>
                  <span className="text-muted-foreground truncate">
                    {result.content.slice(0, 80)}
                    {result.content.length > 80 ? '...' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!loading && searchQuery && results.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-1">
              No matching endnotes found.
            </p>
          )}

          <Separator />

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sm"
            onClick={createNewEndnote}
          >
            <PlusIcon className="size-4 mr-1" />
            Create new endnote
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
