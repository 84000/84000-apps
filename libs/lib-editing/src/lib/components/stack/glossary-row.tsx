'use client';

import { useSyncExternalStore } from 'react';
import type {
  ExtendedTranslationLanguage,
  GlossaryEntry,
  GlossaryEntryName,
} from '@eightyfourthousand/data-access';
import { Button } from '@eightyfourthousand/design-system';

import { GlossaryPassagesLink } from '../shared/glossary/GlossaryPassagesLink';
import type { WorkDocument } from '@eightyfourthousand/lib-doc-model';
import type { StackController } from './StackController';
import { glossaryDefinitionToContent } from './glossary-codec';
import {
  discardGlossaryEdit,
  keepMyGlossaryEntry,
  takeTheirGlossaryEntry,
} from './glossary-save';
import { renderGlossaryRow, type GlossaryWork } from './glossary-work';
import { useStackWork } from './stack-work-context';

const ALTERNATIVE = 'translationAlternative';

/** The entry's English name: its main translation, else its first English. */
export const englishNameOf = (
  entry: GlossaryEntry,
): GlossaryEntryName | undefined => {
  const english = entry.names.filter(({ language }) => language === 'en');
  return english.find(({ termType }) => termType !== ALTERNATIVE) ?? english[0];
};

/**
 * A name's language without its script: a row draws a Tibetan name in both
 * Unicode and Wylie, so "Tibetan (Wylie)" would describe only half of it.
 */
const NAME_LANGUAGE_LABELS: Record<ExtendedTranslationLanguage, string> = {
  en: 'English',
  bo: 'Tibetan',
  'Bo-Ltn': 'Tibetan',
  'Sa-Ltn': 'Sanskrit',
  zh: 'Chinese',
  'Zh-Ltn': 'Chinese',
  ja: 'Japanese',
  'Mt-Ltn': 'Mongolian',
  'Pi-Ltn': 'Pali',
};

const languageLabel = ({ language, termType }: GlossaryEntryName) => {
  if (language === 'en' && termType === ALTERNATIVE) return 'Alternative';
  if (!language) return 'Unknown language';
  return (
    NAME_LANGUAGE_LABELS[language as ExtendedTranslationLanguage] ?? language
  );
};

/**
 * An entry's names above its definition: the English in bold, the others
 * with their languages. Read-only.
 */
export const GlossaryRowNames = ({ entry }: { entry: GlossaryEntry }) => {
  const english = englishNameOf(entry);
  const others = entry.names.filter((name) => name !== english);

  return (
    <div className="flex flex-col gap-1 pb-1" data-glossary-names="">
      {english && (
        <div className="text-primary font-sans text-base font-bold">
          {english.content}
        </div>
      )}
      {!!others.length && (
        <ul className="flex flex-col gap-0.5 text-sm">
          {others.map((name) => (
            <li key={name.nameUuid} className="flex flex-wrap gap-x-2">
              <span className="text-muted-foreground">
                {languageLabel(name)}
              </span>
              {name.contentTransformed && (
                <span className="font-tibetan text-base">
                  {name.contentTransformed}
                </span>
              )}
              <span className={name.language === 'en' ? '' : 'italic'}>
                {name.content}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * A row whose save was refused: the entry as stored now, and the choice
 * between it and the row's own text, which is kept until one is made.
 */
export const GlossaryRowConflict = ({
  glossary,
  uuid,
  onRemove,
}: {
  glossary: GlossaryWork;
  uuid: string;
  /** Take out a row whose entry was deleted, with its instances in `passages`. */
  onRemove?: (passages: WorkDocument[]) => void;
}) => {
  const { conflicts } = glossary;
  const stack = useStackWork();
  const conflict = useSyncExternalStore(
    conflicts.subscribe,
    () => conflicts.get(uuid),
    () => null,
  );
  if (!conflict) return null;
  const { theirs } = conflict;

  return (
    <div
      role="alert"
      className="my-2 flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
      data-glossary-conflict=""
    >
      {theirs ? (
        <>
          <div className="font-medium">
            This definition was changed by someone else since you opened it, so
            your edit was not saved.
          </div>
          <div className="text-muted-foreground">Saved now:</div>
          <div
            className="rounded bg-background p-2"
            dangerouslySetInnerHTML={{
              __html:
                renderGlossaryRow({
                  type: 'doc',
                  content: glossaryDefinitionToContent(theirs.definition),
                }) || '<p><em>No definition</em></p>',
            }}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => takeTheirGlossaryEntry(glossary, uuid)}
            >
              Use theirs
            </Button>
            <Button
              size="sm"
              onClick={() => keepMyGlossaryEntry(glossary, uuid)}
            >
              Keep mine
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="font-medium">
            This entry was deleted by someone else, so your edit was not saved.
          </div>
          <div className="flex gap-2">
            {onRemove && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRemove(stack ? [stack.work] : [])}
              >
                Remove it
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => discardGlossaryEdit(glossary, uuid)}
            >
              Discard my edit
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

/**
 * What a glossary row draws around its definition, or nothing for other rows
 * and for entries not read yet.
 */
export const glossaryRowChrome = (
  controller: StackController,
  uuid: string,
) => {
  const glossary = controller.getGlossary();
  if (controller.getRows() !== 'glossary' || !glossary) return {};
  const entry = controller.getGlossaryEntry(uuid);
  if (!entry) return {};
  return {
    header: (
      <>
        <GlossaryRowNames entry={entry} />
        <GlossaryRowConflict
          glossary={glossary}
          uuid={uuid}
          onRemove={(passages) => controller.forgetGlossaryRow(uuid, passages)}
        />
      </>
    ),
    footer: (
      <GlossaryPassagesLink
        uuid={entry.uuid}
        english={englishNameOf(entry)?.content}
      />
    ),
  };
};
