'use client';

import type {
  ExtendedTranslationLanguage,
  GlossaryEntry,
  GlossaryEntryName,
} from '@eightyfourthousand/data-access';

import { GlossaryPassagesLink } from '../shared/glossary/GlossaryPassagesLink';
import { TITLE_LANGUAGE_LABELS } from '../shared/titles/TitleForm';
import type { StackController } from './StackController';

const ALTERNATIVE = 'translationAlternative';

/** The entry's English name: its main translation, else its first English. */
export const englishNameOf = (
  entry: GlossaryEntry,
): GlossaryEntryName | undefined => {
  const english = entry.names.filter(({ language }) => language === 'en');
  return english.find(({ termType }) => termType !== ALTERNATIVE) ?? english[0];
};

const languageLabel = ({ language, termType }: GlossaryEntryName) => {
  if (language === 'en' && termType === ALTERNATIVE) return 'Alternative';
  if (!language) return 'Unknown language';
  return (
    TITLE_LANGUAGE_LABELS[language as ExtendedTranslationLanguage] ?? language
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
 * What a glossary row draws around its definition, or nothing for other rows
 * and for entries not read yet.
 */
export const glossaryRowChrome = (
  controller: StackController,
  uuid: string,
) => {
  if (controller.getRows() !== 'glossary') return {};
  const entry = controller.getGlossaryEntry(uuid);
  if (!entry) return {};
  return {
    header: <GlossaryRowNames entry={entry} />,
    footer: (
      <GlossaryPassagesLink
        uuid={entry.uuid}
        english={englishNameOf(entry)?.content}
      />
    ),
  };
};
