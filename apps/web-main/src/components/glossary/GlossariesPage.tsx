import { GlossaryLandingItem } from '@data-access';
import { H2 } from '@design-system';
import { GlossariesLandingTable } from './GlossariesLandingTable';

export const GlossariesPage = ({ terms }: { terms: GlossaryLandingItem[] }) => {
  // Clean up the definition field by removing HTML tags
  const rows = terms.map((term) => ({
    ...term,
    definition: term.definition.replace(/<[^>]+>/g, ''),
  }));

  // TODO: derive from terms data
  const types = ['Term', 'Place', 'Person'];
  const languages = ['english', 'tibetan', 'sanskrit'];
  return (
    <div className="flex flex-row justify-center p-4 w-full">
      <div className="w-full max-w-[1466px]">
        <H2>{'Glossaries'}</H2>
        <GlossariesLandingTable
          terms={rows}
          types={types}
          languages={languages}
        />
      </div>
    </div>
  );
};
