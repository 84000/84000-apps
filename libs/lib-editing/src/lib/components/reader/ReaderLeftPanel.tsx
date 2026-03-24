'use client';

import { LeftPanel } from '../shared/LeftPanel';
import { Toc, Work } from '@84000/data-access';

export const ReaderLeftPanel = ({ toc, work }: { toc?: Toc; work: Work }) => {
  return <LeftPanel toc={toc} work={work} limitWhenNoTranslation={true} />;
};
