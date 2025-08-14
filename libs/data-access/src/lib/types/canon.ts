import { TohokuCatalogEntry } from './front-matter';
import { ExtendedTranslationLanguage } from './language';

export type CanonNodeType =
  | 'root'
  | 'canonicalSection'
  | 'nonCanonicalSection'
  | 'textGrouping';

export type CanonDTO = {
  uuid: string;
  created_at: string;
  label: string;
  parent_uuid?: string;
  xmlId: string;
  parent_xmlId?: string;
  sort: number;
  description: string;
  type: CanonNodeType;
  public_description?: string;
  article_uuid?: string;
};

export type CanonHead = {
  children: CanonNode[];
};

export type CanonNode = {
  uuid: string;
  label?: string;
  xmlId?: string;
  parentXmlId?: string;
  parentUuid?: string;
  sort: number;
  description?: string;
  type: CanonNodeType;
  publicDescription?: string;
  articleUuid?: string;
  children?: CanonNode[];
  createdAt?: string;
};

export type CanonArticleDTO = {
  uuid: string;
  title: string;
  body: string;
  image?: string;
  caption?: string;
};

export type CanonArticle = CanonArticleDTO;

export type CanonArticleTitleDTO = {
  title: string;
  language: ExtendedTranslationLanguage;
};

export type CanonArticleTitle = CanonArticleTitleDTO;

export type CanonDetailDTO = {
  uuid: string;
  label: string;
  description: string;
  type: CanonNodeType;
  article?: CanonArticleDTO;
  titles: CanonArticleTitleDTO[];
};
export type CanonDetail = CanonDetailDTO & {
  article?: CanonArticle;
  titles: CanonArticleTitle[];
};

export type CanonWorkStatus = 'published' | 'in-progress' | 'not-started';

export type CanonWorkDTO = {
  uuid: string;
  toh: TohokuCatalogEntry;
  title: string;
  published: boolean;
  status: CanonWorkStatus;
  pages: number;
};

export type CanonWork = CanonWorkDTO;

export type CanonWorksDTO = {
  works: CanonWorkDTO[];
};

export const canonNodeFromDTO = (dto: CanonDTO): CanonNode => {
  return {
    uuid: dto.uuid,
    label: dto.label,
    xmlId: dto.xmlId,
    parentXmlId: dto.parent_xmlId,
    parentUuid: dto.parent_uuid,
    sort: dto.sort,
    description: dto.description,
    type: dto.type,
    publicDescription: dto.public_description,
    articleUuid: dto.article_uuid,
    createdAt: dto.created_at,
  };
};

export const canonTreeFromDTOs = (dtos: CanonDTO[]): CanonHead => {
  const nodes: Record<string, CanonNode> = {};
  dtos.forEach((dto) => {
    nodes[dto.uuid] = canonNodeFromDTO(dto);
  });

  const tree: CanonNode[] = [];

  Object.values(nodes).forEach((node) => {
    if (node.parentUuid) {
      const parent = nodes[node.parentUuid];
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      }
    } else {
      tree.push(node);
    }
  });

  // Sort children by their sort order
  const sortChildren = (children: CanonNode[]) => {
    children.sort((a, b) => a.sort - b.sort);
    children.forEach((child) => {
      if (child.children) {
        sortChildren(child.children);
      }
    });
  };
  sortChildren(tree);

  return {
    children: tree,
  };
};

export const canonDetailFromDTO = (dto: CanonDetailDTO): CanonDetail => {
  return dto as CanonDetail;
};

export const caononWorksFromDTO = (dto: CanonWorksDTO): CanonWork[] => {
  return dto.works as CanonWork[];
};
