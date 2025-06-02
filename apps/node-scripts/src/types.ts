export type PassageAnnotationModel = {
  uuid: string;
  created_at: unknown | null;
  passage_uuid: string;
  content: {
    [key: string]: string;
  }[];
  type: string;
  start: unknown;
  end: unknown;
  passage_xmlId: string | null;
  toh: unknown | null;
};

export type AnnotationTransformer = {
  annotationUuid: string;
  createdAt: unknown;
  passageUuid: string;
  type: string;
  start: unknown;
  end: unknown;
  targetUuid: string;
  passageXmlId?: string;
  xmlId?: string;
  toh?: unknown | null;
};
