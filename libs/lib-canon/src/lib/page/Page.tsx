import {
  createBrowserClient,
  findNodeByUuid,
  flattenCanonTree,
  getCanonSection,
  getCanonTree,
  getCanonWorks,
} from '@data-access';
import { InnerPage } from './InnerPage';

export const CanonPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug: uuid } = await params;

  const client = createBrowserClient();
  const canon = await getCanonTree({ client });
  const node = findNodeByUuid(canon?.children || [], uuid);
  const nodes = node ? flattenCanonTree(node) : [node];
  const uuids = nodes.map((n) => n?.uuid).filter(Boolean) as string[];

  const section = await getCanonSection({ client, uuid });
  const works = await getCanonWorks({ client, uuids });

  if (!section) {
    return <div className="text-center">Section not found</div>;
  }

  return <InnerPage section={section} works={works || []} />;
};
