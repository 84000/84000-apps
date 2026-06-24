import { ReaderLayout } from '@eightyfourthousand/lib-editing';
import { createBrowserClient } from '@eightyfourthousand/data-access';
import { lookupEntityWithClient } from '@eightyfourthousand/data-access/ssr';
import { isUuid } from '@eightyfourthousand/lib-utils';
import { notFound, redirect } from 'next/navigation';
import { ReactNode } from 'react';

const Layout = async ({
  left,
  main,
  right,
  params,
}: {
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  if (!isUuid(slug)) {
    const { path } = await lookupEntityWithClient({
      client: createBrowserClient(),
      type: 'translation',
      entity: slug,
      prefix: '/translations/reader',
    });

    if (path) {
      redirect(path);
    }

    notFound();
  }

  return (
    <ReaderLayout
      withHeader={true}
      left={left}
      main={main}
      right={right}
      params={params}
    />
  );
};

export default Layout;
