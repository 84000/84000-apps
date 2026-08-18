'use client';

import { PlusIcon, Trash2Icon } from 'lucide-react';
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

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden gap-2 px-1 text-xs uppercase text-muted-foreground sm:flex">
        <span className="grow">Title</span>
        <span className="w-56 shrink-0">Type</span>
        <span className="w-44 shrink-0">Language</span>
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
