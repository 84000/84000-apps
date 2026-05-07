import type { AgentDefinition } from '../types';
import { readPrompt } from '../read-prompt';

export const libraryAssistant: AgentDefinition = {
  name: 'library-assistant',
  description:
    'Research assistant for the 84000 library of Tibetan Buddhist texts. Read-only access to translations, glossaries, bibliographies, and metadata.',
  systemPrompt: readPrompt(__dirname),
  tools: [
    'get-translation',
    'get-passage',
    'get-translation-passages',
    'search-translation',
    'get-glossary-term',
    'list-glossary-terms',
    'search-glossary-terms',
    'get-glossary-instances',
    'get-bibliography-entry',
    'list-work-bibliographies',
    'get-imprint',
    'get-toc',
    'lookup-entity',
    'get-work-titles',
  ],
  requiredRole: 'reader',
  model: 'claude-sonnet-4-20250514',
};
