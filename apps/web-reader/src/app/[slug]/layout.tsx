import { ReaderLayout, TranslationSkeleton } from '@eightyfourthousand/lib-editing';
import {
  generateMetadata,
  TranslationStructuredData,
} from '@eightyfourthousand/lib-editing/ssr';
import { ReactNode, Suspense } from 'react';

export { generateMetadata };

const Layout = (props: {
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
  params: Promise<{ slug: string }>;
}) => {
  return (
    <>
      <TranslationStructuredData params={props.params} />
      <Suspense fallback={<TranslationSkeleton />}>
        <ReaderLayout {...props} />
      </Suspense>
    </>
  );
};

export default Layout;
