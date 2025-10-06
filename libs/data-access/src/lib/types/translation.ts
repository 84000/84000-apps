import { BibliographyEntries } from './bibliography';
import { GlossaryTermInstances } from './glossary';
import { BodyItemType, Passages } from './passage';
import { Titles } from './title';
import { Work } from './work';

export type TranslationNodeClass = 'translation' | 'annotation';

export type Translation = {
  metadata: Work;
  titles: Titles;
  passages: Partial<Record<BodyItemType, Passages>>;
  glossary: GlossaryTermInstances;
  bibliography: BibliographyEntries;
};
