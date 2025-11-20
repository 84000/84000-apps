'use client';

import { FrontMatterPanel } from '../shared/FrontMatterPanel';
import { Toc, Work } from '@data-access';

export const ReaderFrontMatterPanel = ({
  toc,
  work,
}: {
  toc?: Toc;
  work: Work;
}) => {
  return <FrontMatterPanel toc={toc} work={work} />;
};
