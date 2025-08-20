import { createBrowserClient, getAllGlossaryTerms } from '@data-access';
import { H2 } from '@design-system';
import { GlossariesLandingTable } from './GlossariesLandingTable';

export const LandingPage = async () => {
  const client = createBrowserClient();
  const terms = await getAllGlossaryTerms({ client });

  // Clean up the definition field by removing HTML tags
  const rows = terms.map((term) => ({
    ...term,
    definition: term.definition.replace(/<[^>]+>/g, ''),
  }));

  // extract types and languages from the terms data
  const types = Array.from(
    new Set(rows.map((term) => term.type.split(', ')).flat()),
  );
  const languages = Array.from(
    new Set(rows.flatMap((term) => term.language)),
  ).filter(Boolean);

  return (
    <div className="flex flex-row justify-center pt-0 pb-8 px-4 w-full">
      <div className="w-full max-w-[1466px]">
        <H2 className="text-navy-500">{'Glossaries'}</H2>
        <GlossariesLandingTable
          terms={rows}
          types={types}
          languages={languages}
        />
      </div>
    </div>
  );
};
