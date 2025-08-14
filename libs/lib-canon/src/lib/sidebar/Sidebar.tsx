'use client';

import { CanonNode } from '@data-access';
import { CanonNavigator } from './CanonNavigator';
import { useCanon } from '../context';

export const Sidebar = () => {
  const { canon } = useCanon();

  const rootNode: CanonNode = {
    uuid: 'root',
    description: '',
    sort: 0,
    type: 'root',
    children: canon.children,
  };

  return (
    <div className="p-4">
      <CanonNavigator
        className="uppercase tracking-wide text-primary/50"
        node={rootNode}
      />
    </div>
  );
};
