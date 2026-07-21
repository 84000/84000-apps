import { Button, Input } from '@eightyfourthousand/design-system';
import { ExtendedTranslationLanguage } from '@eightyfourthousand/data-access';
import { cn } from '@eightyfourthousand/lib-utils';
import { Editor } from '@tiptap/core';
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HighlighterIcon,
  LanguagesIcon,
  QuoteIcon,
  Trash2Icon,
  TypeIcon,
  XIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { HoverInputField } from '../HoverInputField';
import { useNavigation } from '../../../shared';
import type { MentionItem } from './Mention.ssr';

type Mode = 'view' | 'rename' | 'lang' | 'range';

/**
 * Language options offered when tagging a `work` mention. The `lang` attribute
 * drives the `[lang]` typography rules (italic titles, Tibetan font), so the
 * full translation-language set is available.
 */
const LANG_OPTIONS: { name: string; lang: ExtendedTranslationLanguage }[] = [
  { name: 'English', lang: 'en' },
  { name: 'Sanskrit', lang: 'Sa-Ltn' },
  { name: 'Wylie', lang: 'Bo-Ltn' },
  { name: 'Tibetan', lang: 'bo' },
  { name: 'Chinese', lang: 'zh' },
  { name: 'Japanese', lang: 'ja' },
  { name: 'Mongolian', lang: 'Mt-Ltn' },
  { name: 'Pali', lang: 'Pi-Ltn' },
  { name: 'Pinyin', lang: 'Zh-Ltn' },
];

/**
 * Find a mention node in the document that contains an item with the given UUID.
 */
function findMentionNodeByItemUuid(
  editor: Editor,
  itemUuid: string,
):
  | { pos: number; node: ReturnType<Editor['state']['doc']['nodeAt']> }
  | undefined {
  const { doc } = editor.state;
  let result: { pos: number; node: ReturnType<typeof doc.nodeAt> } | undefined;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (node.type.name === 'mention') {
      const items: MentionItem[] = node.attrs.items || [];
      if (items.some((item) => item.uuid === itemUuid)) {
        result = { pos, node };
        return false;
      }
    }
    return true;
  });

  return result;
}

/**
 * Locate the mention node containing the item and apply an edit to it. The
 * node is re-found by uuid at dispatch time, so positions are always fresh —
 * no need to defer past the hover card closing.
 */
function withMentionNode(
  editor: Editor,
  itemUuid: string,
  fn: (
    pos: number,
    node: NonNullable<ReturnType<Editor['state']['doc']['nodeAt']>>,
  ) => void,
) {
  if (editor.isDestroyed) {
    return;
  }

  const found = findMentionNodeByItemUuid(editor, itemUuid);
  if (!found?.node) {
    console.warn('Mention node not found in the document.');
    return;
  }

  fn(found.pos, found.node);
}

/**
 * Hover card for an existing mention. Editing is limited to a few actions:
 * overriding the display text (the persisted `text` property), tagging a
 * `work` mention's language (the `lang` property, which drives title
 * typography), and deleting. Re-pointing a mention at a different entity is not
 * supported — delete and re-insert instead.
 */
export const MentionHoverContent = ({
  uuid,
  entityType,
  entity,
  editor,
  close,
  setHoverCardEditing,
}: {
  uuid: string;
  entityType: string;
  entity: string;
  editor: Editor;
  anchor: HTMLElement;
  close: () => void;
  setHoverCardEditing: (isEditing: boolean) => void;
}) => {
  const [mode, setModeLocal] = useState<Mode>('view');
  const { fetchPassage } = useNavigation();

  // Snapshot the item once when the card opens — the custom override (`text`)
  // pre-fills the rename field, and text/displayText drive the label shown.
  const [item] = useState<MentionItem | undefined>(() => {
    const found = findMentionNodeByItemUuid(editor, uuid);
    const items: MentionItem[] = found?.node?.attrs.items || [];
    return items.find((i) => i.uuid === uuid);
  });
  const currentText = item?.text ?? '';
  // Prefer the display text; fall back to the entity UUID only when unresolved.
  const displayLabel = item?.text || item?.displayText || entity;
  // Language tagging is only meaningful for work titles.
  const isWork = entityType === 'work';
  // Quote styling (superscript label) is only offered for passage mentions.
  const isPassage = entityType === 'passage';

  const setMode = useCallback(
    (next: Mode) => {
      setModeLocal(next);
      setHoverCardEditing(next !== 'view');
    },
    [setHoverCardEditing],
  );

  const mutateItem = useCallback(
    (updater: (item: MentionItem) => MentionItem) => {
      setMode('view');
      close();

      withMentionNode(editor, uuid, (pos, node) => {
        const items: MentionItem[] = (node.attrs.items || []).map(
          (item: MentionItem) => (item.uuid === uuid ? updater(item) : item),
        );

        const { tr } = editor.state;
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, items });
        editor.view.dispatch(tr);
      });
    },
    [editor, uuid, close, setMode],
  );

  const deleteMention = useCallback(() => {
    setMode('view');
    close();

    withMentionNode(editor, uuid, (pos, node) => {
      const items: MentionItem[] = (node.attrs.items || []).filter(
        (item: MentionItem) => item.uuid !== uuid,
      );

      const { tr } = editor.state;
      if (items.length === 0) {
        // Delete the entire node
        tr.delete(pos, pos + node.nodeSize);
      } else {
        // Update items array without deleted item
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, items });
      }
      editor.view.dispatch(tr);
    });
  }, [editor, uuid, close, setMode]);

  // Set or clear the custom override label. Passing no value clears `text`,
  // returning the mention to its dynamically resolved label.
  const renameMention = useCallback(
    (value?: string) => {
      mutateItem((item) => ({ ...item, text: value || undefined }));
    },
    [mutateItem],
  );

  // Set or clear the mention's language tag. Passing no value clears `lang`.
  const setLang = useCallback(
    (lang?: ExtendedTranslationLanguage) => {
      mutateItem((item) => ({ ...item, lang: lang || undefined }));
    },
    [mutateItem],
  );

  // Toggle the `quote` style on/off, clearing it back to the default label.
  const toggleQuoteStyle = useCallback(() => {
    mutateItem((item) => ({
      ...item,
      style: item.style === 'quote' ? undefined : 'quote',
    }));
  }, [mutateItem]);

  // Highlight-range editing (only offered for `quote`-styled passage mentions).
  // The range highlights text in the *linked* passage, so its text is fetched
  // to preview the selection.
  const [rangeStart, setRangeStart] = useState(
    item?.highlightStart != null ? String(item.highlightStart) : '',
  );
  const [rangeEnd, setRangeEnd] = useState(
    item?.highlightEnd != null ? String(item.highlightEnd) : '',
  );
  const [passageText, setPassageText] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'range' || !entity) {
      return;
    }
    let cancelled = false;
    (async () => {
      const passage = await fetchPassage(entity);
      if (!cancelled) {
        setPassageText(passage?.content ?? '');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, entity, fetchPassage]);

  const start = Number(rangeStart);
  const end = Number(rangeEnd);
  const hasValidRange =
    rangeStart !== '' &&
    rangeEnd !== '' &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start >= 0 &&
    end > start;

  // Persist the range, or clear it when the inputs don't describe a valid one.
  const saveRange = useCallback(() => {
    mutateItem((item) => ({
      ...item,
      highlightStart: hasValidRange ? start : undefined,
      highlightEnd: hasValidRange ? end : undefined,
    }));
  }, [mutateItem, hasValidRange, start, end]);

  if (mode === 'rename') {
    return (
      <div className="flex justify-between gap-2 p-2 w-fit max-w-80">
        <HoverInputField
          type="mention"
          attr="text"
          valueRef={currentText}
          placeholder="Custom label (leave empty to reset)…"
          onSubmit={(value) => renameMention(value)}
        />
      </div>
    );
  }

  if (mode === 'lang') {
    return (
      <div className="flex flex-col gap-0.5 p-1 w-40">
        <div className="flex items-center gap-1 px-1 pb-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 [&_svg]:size-4"
            title="Back"
            onClick={() => setMode('view')}
          >
            <ChevronLeftIcon className="text-primary" />
          </Button>
          <span className="text-primary text-sm my-auto">Language</span>
        </div>
        {LANG_OPTIONS.map((option) => (
          <div
            key={option.lang}
            className="flex items-center text-sm rounded-md hover:bg-muted text-foreground px-2 py-1.5 cursor-pointer"
            onClick={() => setLang(option.lang)}
          >
            <span>{option.name}</span>
            <div className="flex-1" />
            {item?.lang === option.lang && (
              <CheckIcon className="size-3.5 ms-4" />
            )}
          </div>
        ))}
        {item?.lang && (
          <>
            <div className="h-px bg-border my-1" />
            <div
              className="flex items-center text-sm rounded-md hover:bg-muted text-foreground px-2 py-1.5 cursor-pointer"
              onClick={() => setLang(undefined)}
            >
              <span>Clear</span>
              <div className="flex-1" />
              <XIcon className="size-3.5 ms-4" />
            </div>
          </>
        )}
      </div>
    );
  }

  if (mode === 'range') {
    // Clamp for the preview so an over-long end still shows a sensible slice.
    const previewEnd =
      passageText != null ? Math.min(end, passageText.length) : end;

    return (
      <div className="flex flex-col gap-2 p-2 w-80">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 [&_svg]:size-4"
            title="Back"
            onClick={() => setMode('view')}
          >
            <ChevronLeftIcon className="text-primary" />
          </Button>
          <span className="text-primary text-sm my-auto">Highlight range</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex flex-col gap-0.5 flex-1">
            <span className="text-xs text-muted-foreground">Start</span>
            <Input
              type="number"
              min={0}
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-0.5 flex-1">
            <span className="text-xs text-muted-foreground">End</span>
            <Input
              type="number"
              min={0}
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
            />
          </label>
        </div>

        <div className="max-h-32 overflow-auto rounded-md border border-border p-2 text-sm leading-relaxed">
          {passageText == null ? (
            <span className="text-muted-foreground">Loading…</span>
          ) : !hasValidRange ? (
            <span className="text-muted-foreground">
              Enter a start and end offset (end after start) to preview the
              highlighted text.
            </span>
          ) : (
            <span className="text-foreground/70">
              {passageText.slice(0, start)}
              <mark className="bg-highlight text-foreground rounded-sm">
                {passageText.slice(start, previewEnd)}
              </mark>
              {passageText.slice(previewEnd)}
            </span>
          )}
        </div>

        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 [&_svg]:size-4"
            title="Clear range"
            onClick={() => {
              setRangeStart('');
              setRangeEnd('');
            }}
          >
            <Trash2Icon className="text-destructive" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 [&_svg]:size-4"
            title="Save range"
            onClick={saveRange}
          >
            <CheckIcon className="text-primary" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-between gap-2 p-2 w-fit max-w-80">
      <span className="text-primary text-sm my-auto">{entityType}</span>
      <ChevronRightIcon className="my-auto size-4" />
      <span className="truncate text-muted-foreground text-sm my-auto">
        {displayLabel}
      </span>
      <span className="flex-grow" />
      {isWork && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 [&_svg]:size-4"
          title="Set language"
          onClick={() => setMode('lang')}
        >
          <LanguagesIcon className="text-primary my-auto" />
        </Button>
      )}
      {isPassage && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 [&_svg]:size-4"
          title="Toggle quote style"
          onClick={toggleQuoteStyle}
        >
          <QuoteIcon
            className={cn(
              'my-auto',
              item?.style === 'quote' ? 'text-primary' : 'text-foreground/50',
            )}
          />
        </Button>
      )}
      {isPassage && item?.style === 'quote' && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 [&_svg]:size-4"
          title="Set highlight range"
          onClick={() => setMode('range')}
        >
          <HighlighterIcon
            className={cn(
              'my-auto',
              item?.highlightStart != null
                ? 'text-primary'
                : 'text-foreground/50',
            )}
          />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-6 [&_svg]:size-4"
        title="Edit display text"
        onClick={() => setMode('rename')}
      >
        <TypeIcon className="text-primary my-auto" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 [&_svg]:size-4"
        title="Remove mention"
        onClick={deleteMention}
      >
        <Trash2Icon className="text-destructive my-auto" />
      </Button>
    </div>
  );
};
