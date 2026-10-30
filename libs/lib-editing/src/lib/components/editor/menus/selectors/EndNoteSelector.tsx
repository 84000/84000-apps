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
import { createGraphQLClient } from '@eightyfourthousand/client-graphql';
import { gql } from 'graphql-request';
import { useNavigation } from '../../../shared';
import { useStackWork } from '../../../stack/StackWorkProvider';
import { createStackEndnote } from '../../../stack/stack-endnotes';

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

  const stack = useStackWork();
  const { uuid: workUuid, updatePanel } = useNavigation();

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
      // The search reads saved labels; the stack's may have moved since.
      const label =
        stack?.work.spine.meta(endnoteUuid)?.label ?? endnoteLabel ?? undefined;
      editor
        .chain()
        .focus()
        .setEndNoteLink(endnoteUuid, label)
        .setTextSelection(to)
        .run();
      dismiss();
    },
    [editor, dismiss, stack],
  );

  /** The passage stack's version: the endnote and its link as one change. */
  const createStackNote = useCallback(
    async (stackWork: NonNullable<typeof stack>) => {
      const { to } = editor.state.selection;
      const result = await createStackEndnote({ stack: stackWork, editor });
      if ('error' in result) {
        toast(result.error, {
          icon: <TriangleAlertIcon className="size-4 text-warning" />,
        });
        dismiss();
        return;
      }

      editor.chain().focus().setTextSelection(to).run();
      updatePanel({
        name: 'right',
        state: { open: true, tab: 'endnotes', hash: result.uuid },
      });
      dismiss();
    },
    [editor, updatePanel, dismiss],
  );

  const createNewEndnote = useCallback(async () => {
    if (stack && editor.view.dom.closest('[data-stack-passage]')) {
      await createStackNote(stack);
      return;
    }

    // Only the passage stack holds the endnotes a new note goes into.
    toast('Open the Notes panel to add an endnote.', {
      icon: <TriangleAlertIcon className="size-4 text-warning" />,
    });
    dismiss();
  }, [editor, stack, createStackNote, dismiss]);


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
