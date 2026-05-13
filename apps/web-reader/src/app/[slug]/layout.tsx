import { ReaderLayout, TranslationSkeleton } from '@eightyfourthousand/lib-editing';
import {
  generateMetadata,
  hasBodyTranslationContent,
  TranslationStructuredData,
} from '@eightyfourthousand/lib-editing/ssr';
import { ReactNode, Suspense } from 'react';
import { isUuid } from '@eightyfourthousand/lib-utils';

export { generateMetadata };

const Layout = async (props: {
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await props.params;
  const initialHasTranslationContent = isUuid(slug)
    ? await hasBodyTranslationContent({ uuid: slug })
    : true;

  return (
    <>
      <TranslationStructuredData params={props.params} />
      <Suspense fallback={<TranslationSkeleton />}>
        <ReaderLayout
          {...props}
          initialHasTranslationContent={initialHasTranslationContent}
        />
      </Suspense>
    </>
  );
};

export default Layout;
