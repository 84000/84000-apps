import { ReaderLayout, TranslationSkeleton } from '@lib-editing';
import { generateMetadata } from '@lib-editing/ssr';
import { ReactNode, Suspense } from 'react';

export { generateMetadata };

const Layout = (props: {
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
  params: Promise<{ slug: string }>;
}) => {
  return (
    <Suspense fallback={<TranslationSkeleton />}>
      <ReaderLayout {...props} />
    </Suspense>
  );
};

export default Layout;
