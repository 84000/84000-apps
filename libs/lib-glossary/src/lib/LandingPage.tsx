import { createBrowserClient, getAllGlossaryTerms } from '@data-access';
import { H2 } from '@design-system';
import { GlossariesLandingTable } from './GlossariesLandingTable';

export const LandingPage = async () => {
  const client = createBrowserClient();
  const terms = await getAllGlossaryTerms({ client });

  // extract types and languages from the terms data
  const types = Array.from(
    new Set(terms.map((term) => term.type.split(', ')).flat()),
  );
  const languages = Array.from(
    new Set(terms.flatMap((term) => term.language)),
  ).filter(Boolean);

  return (
    <div className="flex flex-row justify-center pt-0 pb-8 px-4 w-full bg-surface">
      <div className="w-full max-w-feed">
        <H2 className="text-navy-500">{'Glossaries'}</H2>
        <GlossariesLandingTable
          terms={terms}
          types={types}
          languages={languages}
        />
      </div>
    </div>
  );
};
