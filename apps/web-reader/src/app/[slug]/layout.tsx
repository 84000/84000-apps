import { ReaderLayout, TranslationSkeleton } from '@lib-editing';
import { ReactNode, Suspense } from 'react';

export const Layout = (props: {
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
