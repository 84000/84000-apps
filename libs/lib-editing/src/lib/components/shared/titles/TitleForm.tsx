'use client';

import { useState } from 'react';
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import {
  type ExtendedTranslationLanguage,
  TITLE_TYPES,
  type Title,
  type Titles,
  type TitleType,
} from '@eightyfourthousand/data-access';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@eightyfourthousand/design-system';
import { cn } from '@eightyfourthousand/lib-utils';

/**
 * Human-readable names for the title types stored on `public.titles`. The
 * picker iterates `TITLE_TYPES`, which fixes the order.
 */
export const TITLE_TYPE_LABELS: Record<TitleType, string> = {
  mainTitle: 'Main title',
  mainTitleOutsideCatalogueSection: 'Main title outside catalogue section',
  longTitle: 'Long title',
  otherTitle: 'Other title',
  toh: 'Tohoku number',
  shortcode: 'Short code',
};

/**
 * The languages a title may be recorded in, with the labels editors use for
 * them. Ordered by how much of the corpus each accounts for.
 */
export const TITLE_LANGUAGE_LABELS: Record<
  ExtendedTranslationLanguage,
  string
> = {
  en: 'English',
  bo: 'Tibetan',
  'Bo-Ltn': 'Tibetan (Wylie)',
  'Sa-Ltn': 'Sanskrit (Latin)',
  zh: 'Chinese',
  'Zh-Ltn': 'Chinese (Pinyin)',
  ja: 'Japanese',
  'Mt-Ltn': 'Mongolian (Latin)',
  'Pi-Ltn': 'Pali (Latin)',
};

const TITLE_LANGUAGES = Object.keys(
  TITLE_LANGUAGE_LABELS,
) as ExtendedTranslationLanguage[];

/**
 * The default shape of a title added from an empty row: the type and language
 * that between them account for most of the corpus.
 */
export const NEW_TITLE_TYPE: TitleType = 'mainTitle';
export const NEW_TITLE_LANGUAGE: ExtendedTranslationLanguage = 'en';

/**
 * Mint an empty title row. The UUID is generated client-side because the row is
 * inserted by UUID, the same way imported titles are created.
 */
export const emptyTitle = (): Title => ({
  uuid: crypto.randomUUID(),
  title: '',
  type: NEW_TITLE_TYPE,
  language: NEW_TITLE_LANGUAGE,
});

/** The columns the row list can be sorted by. */
export type TitleSortColumn = 'title' | 'type' | 'language';

export type TitleSort = { column: TitleSortColumn; direction: 'asc' | 'desc' };

/**
 * How the rows are ordered when the dialog opens. Grouping by type is what an
 * editor scanning the list expects, and a default matters here because the
 * stored order is arbitrary — `get_work_titles` has no `ORDER BY`, and an edited
 * row moves to the end of the heap, so an unsorted list would put the title you
 * just changed at the bottom.
 */
export const DEFAULT_TITLE_SORT: TitleSort = {
  column: 'type',
  direction: 'asc',
};

// Every column sorts by the text the editor can actually see: the label in the
// picker, not the underlying enum value. Ordering type by the canonical
// TITLE_TYPES sequence would put 'Tohoku number' above 'Main title' for reasons
// invisible in the dialog, which reads as a broken sort. The canonical order
// still governs the order options appear *within* each picker.
const displayedValue = (column: TitleSortColumn, title: Title): string => {
  switch (column) {
    case 'type':
      return TITLE_TYPE_LABELS[title.type] ?? title.type;
    case 'language':
      return TITLE_LANGUAGE_LABELS[title.language] ?? title.language;
    case 'title':
    default:
      return title.title;
  }
};

const compareBy = (column: TitleSortColumn, a: Title, b: Title): number =>
  displayedValue(column, a).localeCompare(displayedValue(column, b));

/**
 * Order titles by one column — comparing the text shown in that column —
 * falling back through the remaining ones so the result is total and therefore
 * stable across repeated sorts.
 *
 * Row order is presentation only: nothing persists it, and the save diffs by
 * UUID, so reordering never changes what is written.
 */
export const sortTitles = (
  titles: Titles,
  column: TitleSortColumn = DEFAULT_TITLE_SORT.column,
  direction: 'asc' | 'desc' = DEFAULT_TITLE_SORT.direction,
): Titles => {
  const factor = direction === 'asc' ? 1 : -1;
  return [...titles].sort(
    (a, b) =>
      // Only the chosen column reverses; the tie-breakers keep their order so
      // rows that compare equal do not shuffle between clicks.
      factor * compareBy(column, a, b) ||
      compareBy('type', a, b) ||
      compareBy('language', a, b) ||
      compareBy('title', a, b),
  );
};

/**
 * A clickable column heading that sorts the row list.
 *
 * Declared at module scope rather than inside `TitleForm` so it keeps its
 * identity across renders — a component redefined each render remounts, and the
 * button would lose focus on the very click that sorted.
 *
 * The rows are a flex layout rather than a `<table>`, so `aria-sort` has no
 * valid host here; the direction goes into the accessible name instead.
 */
const SortHeader = ({
  column,
  label,
  sort,
  disabled,
  onSort,
  className,
}: {
  column: TitleSortColumn;
  label: string;
  sort: TitleSort;
  disabled?: boolean;
  onSort: (column: TitleSortColumn) => void;
  className?: string;
}) => {
  const active = sort.column === column;
  const state = active
    ? ` (currently ${sort.direction === 'asc' ? 'ascending' : 'descending'})`
    : '';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSort(column)}
      aria-label={`Sort by ${label.toLowerCase()}${state}`}
      className={cn(
        'flex items-center gap-1 text-left uppercase transition-colors hover:text-foreground disabled:cursor-not-allowed',
        active && 'text-foreground',
        className,
      )}
    >
      {label}
      {active ? (
        sort.direction === 'asc' ? (
          <ArrowUpIcon className="size-3" />
        ) : (
          <ArrowDownIcon className="size-3" />
        )
      ) : (
        <ArrowUpDownIcon className="size-3 opacity-40" />
      )}
    </button>
  );
};

/**
 * Edit a work's titles as a list of rows, one row per title.
 *
 * Titles are keyed by type *and* language and a work may carry several of the
 * same type, so a row — rather than a field per language — is the unit that
 * matches the data. Edits are held by the caller and only reach the database
 * when it saves.
 */
export const TitleForm = ({
  titles = [],
  disabled = false,
  onChange,
}: {
  titles?: Titles;
  disabled?: boolean;
  onChange: (titles: Titles) => void;
}) => {
  const [sort, setSort] = useState<TitleSort>(DEFAULT_TITLE_SORT);

  const replaceAt = (index: number, changes: Partial<Title>) => {
    onChange(
      titles.map((title, idx) =>
        idx === index ? { ...title, ...changes } : title,
      ),
    );
  };

  const removeAt = (index: number) => {
    onChange(titles.filter((_, idx) => idx !== index));
  };

  // Sorting reorders the rows the caller holds rather than a display copy,
  // because rows are edited by index — sorting only the view would send a
  // keystroke in one row to another. It runs once per click rather than
  // continuously for the same reason a spreadsheet does not re-sort as you
  // type: a row that moved mid-edit would take the cursor with it.
  const sortBy = (column: TitleSortColumn) => {
    const direction =
      sort.column === column && sort.direction === 'asc' ? 'desc' : 'asc';
    setSort({ column, direction });
    onChange(sortTitles(titles, column, direction));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden gap-2 px-1 text-xs text-muted-foreground sm:flex">
        <SortHeader
          column="title"
          label="Title"
          sort={sort}
          disabled={disabled}
          onSort={sortBy}
          className="grow"
        />
        <SortHeader
          column="type"
          label="Type"
          sort={sort}
          disabled={disabled}
          onSort={sortBy}
          className="w-56 shrink-0"
        />
        <SortHeader
          column="language"
          label="Language"
          sort={sort}
          disabled={disabled}
          onSort={sortBy}
          className="w-44 shrink-0"
        />
        <span className="w-9 shrink-0" />
      </div>

      {titles.length === 0 && (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">
          This work has no titles yet.
        </p>
      )}

      {titles.map((title, index) => (
        <div
          key={title.uuid}
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <div className="grow">
            <Label className="sr-only" htmlFor={`title-content-${title.uuid}`}>
              Title
            </Label>
            <Input
              id={`title-content-${title.uuid}`}
              type="text"
              placeholder="Enter title"
              disabled={disabled}
              value={title.title}
              className={cn(title.language === 'bo' && 'font-tibetan')}
              onChange={(e) => replaceAt(index, { title: e.target.value })}
            />
          </div>

          <div className="w-full shrink-0 sm:w-56">
            <Label className="sr-only" htmlFor={`title-type-${title.uuid}`}>
              Type
            </Label>
            <Select
              value={title.type}
              disabled={disabled}
              onValueChange={(value) =>
                replaceAt(index, { type: value as TitleType })
              }
            >
              <SelectTrigger id={`title-type-${title.uuid}`} className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {TITLE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {TITLE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full shrink-0 sm:w-44">
            <Label className="sr-only" htmlFor={`title-language-${title.uuid}`}>
              Language
            </Label>
            <Select
              value={title.language}
              disabled={disabled}
              onValueChange={(value) =>
                replaceAt(index, {
                  language: value as ExtendedTranslationLanguage,
                })
              }
            >
              <SelectTrigger
                id={`title-language-${title.uuid}`}
                className="w-full"
              >
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {TITLE_LANGUAGES.map((language) => (
                  <SelectItem key={language} value={language}>
                    {TITLE_LANGUAGE_LABELS[language]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={disabled}
            className="size-9 shrink-0 self-end text-muted-foreground hover:text-destructive sm:self-auto"
            aria-label={`Remove ${title.title || 'untitled'} title`}
            onClick={() => removeAt(index)}
          >
            <Trash2Icon />
          </Button>
        </div>
      ))}

      <div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onChange([...titles, emptyTitle()])}
        >
          <PlusIcon />
          Add title
        </Button>
      </div>
    </div>
  );
};
