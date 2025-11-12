import { ReaderLayout } from '@lib-editing';
import { ReactNode } from 'react';

const Layout = ({
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
