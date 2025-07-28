import { createBrowserClient, getAllGlossaryTerms } from '@data-access';
import { GlossariesPage } from '../../../components/glossary/GlossariesPage';

export const revalidate = 60;

const page = async () => {
  const client = createBrowserClient();
  const terms = await getAllGlossaryTerms({ client });

  return <GlossariesPage terms={terms} />;
};

export default page;
