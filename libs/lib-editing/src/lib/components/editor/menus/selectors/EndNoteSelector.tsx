'use client';

import { cn } from '@lib-utils';
import { Editor } from '@tiptap/core';
import { useEditorState as useTiptapEditorState } from '@tiptap/react';
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from '@design-system';
import { AsteriskIcon, Loader2Icon, PlusIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { createGraphQLClient } from '@client-graphql';
import { gql } from 'graphql-request';
import { useEditorState } from '../../EditorProvider';
import { useNavigation } from '../../../shared';
import {
  findLastEndNoteLinkBefore,
  getLastEndnoteInEditor,
  insertEndnotePassage,
  syncEndnoteLinkLabelsAcrossEditors,
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

  const { getEditor } = useEditorState();
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
          filter: { type: 'endnotes', label: labelPattern },
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

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!searchQuery.trim()) {
      setResults([]);
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

  const linkToExisting = useCallback(
    (endnoteUuid: string, endnoteLabel: string | null) => {
      const { to } = editor.state.selection;
      editor
        .chain()
        .focus()
        .setEndNoteLink(endnoteUuid, endnoteLabel ?? undefined)
        .setTextSelection(to)
        .run();
      setOpen(false);
      setSearchQuery('');
      setResults([]);
    },
    [editor],
  );

  const createNewEndnote = useCallback(async () => {
    const endnotesEditor = getEditor('endnotes');
    const { from, to } = editor.state.selection;
    const selectionIsRange = from !== to;

    // Detect split case: selection is within an existing endNoteLink mark
    const nodeAtFrom = selectionIsRange
      ? editor.state.doc.nodeAt(from)
      : null;
    const splitMark = nodeAtFrom?.marks.find(
      (m) => m.type.name === 'endNoteLink',
    );
    const splitNote =
      splitMark &&
      (splitMark.attrs.notes as { endNote: string }[] | undefined)?.find(
        (n) => n.endNote,
      );

    // Find the previous endnote link before cursor to determine insertion point
    const prevLink = findLastEndNoteLinkBefore(editor, from);

    let newLabel: string;
    let newSort: number;
    let afterPassageUuid: string | undefined;
    let beforePassageUuid: string | undefined;

    if (splitNote) {
      // Split case: the new endnote takes the existing passage's label and
      // is inserted before it. The existing passage gets incremented.
      const passage = await fetchEndNote(splitNote.endNote);
      if (passage) {
        newLabel = passage.label || 'n.1';
        newSort = passage.sort;
        beforePassageUuid = passage.uuid;
      } else if (endnotesEditor) {
        const last = getLastEndnoteInEditor(endnotesEditor);
        newLabel = last ? incrementLabel(last.label) : 'n.1';
        newSort = last ? last.sort + 1 : 1;
      } else {
        newLabel = 'n.1';
        newSort = 1;
      }
    } else if (prevLink) {
      // Try to get the label/sort from the endnotes editor or API
      const passage = await fetchEndNote(prevLink.endNote);
      if (passage) {
        newLabel = incrementLabel(passage.label || 'n.0');
        newSort = passage.sort + 1;
        afterPassageUuid = passage.uuid;
      } else if (endnotesEditor) {
        const last = getLastEndnoteInEditor(endnotesEditor);
        newLabel = last ? incrementLabel(last.label) : 'n.1';
        newSort = last ? last.sort + 1 : 1;
      } else {
        newLabel = 'n.1';
        newSort = 1;
      }
    } else if (endnotesEditor) {
      // No previous link; append after last endnote
      const last = getLastEndnoteInEditor(endnotesEditor);
      newLabel = last ? incrementLabel(last.label) : 'n.1';
      newSort = last ? last.sort + 1 : 1;
    } else {
      newLabel = 'n.1';
      newSort = 1;
    }

    const newPassageUuid = uuidv4();

    // Insert endNoteLink mark in main editor with the label for immediate display,
    // then collapse the selection to dismiss the bubble menu.
    editor
      .chain()
      .focus()
      .setEndNoteLink(newPassageUuid, newLabel)
      .setTextSelection(to)
      .run();

    // Insert new passage in endnotes editor at the correct position
    if (endnotesEditor) {
      insertEndnotePassage(endnotesEditor, {
        label: newLabel,
        sort: newSort,
        uuid: newPassageUuid,
        afterPassageUuid,
        beforePassageUuid,
      });

      // Sync updated labels into endNoteLink marks across front + translation
      syncEndnoteLinkLabelsAcrossEditors(endnotesEditor, getEditor);
    }

    // Navigate to the new endnote
    updatePanel({
      name: 'right',
      state: { open: true, tab: 'endnotes', hash: newPassageUuid },
    });

    // Focus the new endnote passage after navigation
    if (endnotesEditor) {
      setTimeout(() => {
        const { doc } = endnotesEditor.state;
        doc.descendants((node, pos) => {
          if (
            node.type.name === 'passage' &&
            node.attrs.uuid === newPassageUuid
          ) {
            const targetPos = pos + 2;
            endnotesEditor.commands.focus(targetPos);
            return false;
          }
          return true;
        });
      }, 200);
    }

    setOpen(false);
    setSearchQuery('');
    setResults([]);
  }, [editor, getEditor, fetchEndNote, updatePanel]);

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
