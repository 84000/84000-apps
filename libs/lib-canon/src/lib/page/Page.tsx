import { createBrowserClient, getCanonSection } from '@data-access';
import { InnerPage } from './InnerPage';

export const CanonPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug: uuid } = await params;
  const client = createBrowserClient();
  const section = await getCanonSection({ client, uuid });

  if (!section) {
    return <div className="text-center">Section not found</div>;
  }

  return <InnerPage section={section} />;
};
