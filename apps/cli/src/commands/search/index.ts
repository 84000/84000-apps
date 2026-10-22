import { groupUsage, type Command } from '../../command';
import { CORPUS_NOTE } from './corpus-note';
import { quotes } from './quotes';

const commands = [quotes];

/** `eft search`: search Tibetan eTexts, in Unicode or EWTS. */
export const search: Command = {
  name: 'search',
  summary: 'Search Tibetan eTexts, in Unicode or EWTS.',
  usage: groupUsage(
    'eft search',
    `eft search: search Tibetan eTexts, in Unicode or EWTS.\n\n${CORPUS_NOTE}`,
    commands,
  ),
  commands,
};
