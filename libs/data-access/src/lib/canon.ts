import {
  CanonDTO,
  CanonDetailDTO,
  CanonNode,
  CanonWorksDTO,
  DataClient,
  canonDetailFromDTO,
  canonNodeFromDTO,
  canonTreeFromDTOs,
  caononWorksFromDTO,
} from './types';

export const getCanonSections = async ({
  client,
}: {
  client: DataClient;
}): Promise<CanonNode[]> => {
  const { data, error } = await client.rpc('scholar_canon_get_all');

  if (error) {
    console.error('Error fetching canon sections:', error);
    return [];
  }

  return data.map((item: CanonDTO) => canonNodeFromDTO(item));
};

export const getCanonTree = async ({ client }: { client: DataClient }) => {
  const { data, error } = await client.rpc('scholar_canon_get_all');

  if (error) {
    console.error('Error fetching canon tree:', error);
    return null;
  }

  return canonTreeFromDTOs(data as CanonDTO[]);
};

export const getCanonSection = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data, error } = await client.rpc('scholar_canon_get_detail', {
    uuid_input: uuid,
  });

  if (error) {
    console.error('Error fetching canon section:', error);
    return null;
  }

  return canonDetailFromDTO(data[0] as CanonDetailDTO);
};

export const getCanonWorks = async ({
  client,
  uuids,
}: {
  client: DataClient;
  uuids: string[];
}) => {
  const { data, error } = await client
    .rpc('scholar_canon_get_works', {
      uuids_input: uuids,
    })
    .single();

  if (error) {
    console.error('Error fetching canon works:', error);
    return null;
  }

  return caononWorksFromDTO(data as CanonWorksDTO);
};

/** Travers the canon tree to find a node by its UUID */
export const findNodeByUuid = (
  head: CanonNode[],
  uuid: string,
): CanonNode | null => {
  for (const node of head) {
    if (node.uuid === uuid) {
      return node;
    }
    if (node.children) {
      const found = findNodeByUuid(node.children, uuid);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

/** Flatten the canon tree into a list of nodes */
export const flattenCanonTree = (head: CanonNode): CanonNode[] => {
  const flatList: CanonNode[] = [head];

  const traverse = (node: CanonNode) => {
    flatList.push(node);
    if (node.children) {
      node.children.forEach(traverse);
    }
  };

  head.children?.forEach(traverse);
  return flatList;
};
