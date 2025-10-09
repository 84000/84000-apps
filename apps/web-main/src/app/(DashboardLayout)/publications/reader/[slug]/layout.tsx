import { ReaderLayout } from '@lib-editing';
import { ReactNode } from 'react';

const Layout = async ({
  left,
  main,
  right,
}: {
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
}) => {
  return <ReaderLayout left={left} main={main} right={right} />;
};

export default Layout;
