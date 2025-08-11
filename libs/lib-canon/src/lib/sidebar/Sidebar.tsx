import { CanonNode, createBrowserClient, getCanonTree } from '@data-access';
import { CanonNavigator } from './CanonNavigator';

export const Sidebar = async () => {
  const client = createBrowserClient();
  const canon = await getCanonTree({ client });

  if (!canon) {
    return <div className="text-red-500">Failed to load canon tree.</div>;
  }

  const rootNode: CanonNode = {
    uuid: 'root',
    description: '',
    sort: 0,
    type: 'root',
    children: canon.children,
  };

  return (
    <CanonNavigator
      className="uppercase tracking-wide text-primary/50"
      node={rootNode}
    />
  );
};
