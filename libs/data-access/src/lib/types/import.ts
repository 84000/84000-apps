import { Annotation } from './annotation';
import { BodyItemType, Passage } from './passage';

/**
 * Annotation operation to create while previewing or persisting imported text.
 */
export interface PreviewAnnotationOperation {
  /** Annotation kind or class produced by mapping rules. */
  kind: string;
  /** Inclusive start offset within the containing passage content. */
  start: number;
  /** Exclusive end offset within the containing passage content. */
  end: number;
  /** Additional annotation-specific attributes. */
  data?: Record<string, unknown>;
}

/**
 * Operation that patches metadata on the target work.
 */
export interface WorkUpdateOperation {
  kind: 'update_work';
  /** Partial database patch derived from imported metadata. */
  patch: Record<string, unknown>;
}

/**
 * Operation that inserts a title for the target work.
 */
export interface TitleInsertOperation {
  kind: 'insert_title';
  /** Title row to insert. */
  title: {
    /** Generated title UUID. */
    uuid: string;
    /** Work that owns the title. */
    workUuid: string;
    /** Title text. */
    content: string;
    /** BCP-style language code for the title, when known. */
    language?: string;
    /** Title classification, such as main title or long title. */
    type: string;
  };
}

/**
 * Operation that creates or updates folio-level annotation metadata.
 */
export interface FolioAnnotationOperation {
  kind: 'upsert_folio_annotation';
  /** Partial database patch for the folio annotation row. */
  patch: Record<string, unknown>;
}

/**
 * Operation that inserts a passage and its child annotations.
 */
export interface PassageInsertOperation {
  kind: 'insert_passage';
  /** Passage row to insert for the target work. */
  passage: {
    /** Generated passage UUID. */
    uuid: string;
    /** Work that owns the passage. */
    workUuid: string;
    /** Human-readable passage label. */
    label: string;
    /** Sort order within the work. */
    sort: number;
    /** Passage body item type. */
    type: string;
    /** Plain text passage content. */
    content: string;
    /** Source XML identifier, when a mapping produced one. */
    xmlId?: string;
  };
  /** Annotation operations scoped to this passage. */
  annotations: PreviewAnnotationOperation[];
}

/**
 * Discriminated union of all importer operations.
 */
export type ImportOperation =
  | WorkUpdateOperation
  | TitleInsertOperation
  | FolioAnnotationOperation
  | PassageInsertOperation;

/**
 * Loosened import operation accepted from an agent or MCP tool caller.
 *
 * Generated identifiers, per-row work references, passage sort order, and
 * xmlIds are optional here — the agent should not have to invent them. They are
 * filled in deterministically by `normalizeImportOperations` before the
 * operations are persisted, so callers can focus on the structural mapping.
 */
export type ImportOperationInput =
  | WorkUpdateOperation
  | {
      kind: 'insert_title';
      title: {
        /** Generated title UUID; assigned when omitted. */
        uuid?: string;
        /** Owning work; defaults to the import target when omitted. */
        workUuid?: string;
        content: string;
        language?: string;
        type: string;
      };
    }
  | FolioAnnotationOperation
  | {
      kind: 'insert_passage';
      passage: {
        /** Generated passage UUID; assigned when omitted. */
        uuid?: string;
        /** Owning work; defaults to the import target when omitted. */
        workUuid?: string;
        label: string;
        /** Sort order within the work; assigned in source order when omitted. */
        sort?: number;
        type: string;
        content: string;
        xmlId?: string;
      };
      annotations?: PreviewAnnotationOperation[];
    };

/**
 * A reviewable set of import operations and their summary counts.
 */
export interface ImportPreview {
  /** Ordered operations that would be applied for the import. */
  operations: ImportOperation[];
  /** Summary counts for the generated operations. */
  counts: {
    /** Number of title insert operations. */
    titles: number;
    /** Number of passage insert operations. */
    passages: number;
    /** Number of annotation operations across passages. */
    annotations: number;
    /** Number of work metadata updates. */
    workUpdates: number;
    /** Number of folio annotation updates. */
    folioUpdates: number;
  };
}

const HEADING_CLASS_FALLBACK = 'section-title';

export const previewAnnotationToAnnotation = ({
  annotation,
  passageUuid,
  passageText,
}: {
  annotation: PreviewAnnotationOperation;
  passageUuid: string;
  passageText: string;
}): Annotation | null => {
  const base = {
    uuid: `${passageUuid}:${annotation.kind}:${annotation.start}:${annotation.end}`,
    start: annotation.start,
    end: annotation.end,
    passageUuid,
  };

  if (annotation.kind === 'blockquote') {
    return { ...base, type: 'blockquote' };
  }

  if (annotation.kind === 'paragraph') {
    return { ...base, type: 'paragraph' };
  }

  if (annotation.kind === 'indent') {
    return { ...base, type: 'indent' };
  }

  if (annotation.kind === 'line-group') {
    return { ...base, type: 'lineGroup' };
  }

  if (annotation.kind === 'line') {
    return { ...base, type: 'line' };
  }

  if (annotation.kind === 'span') {
    return {
      ...base,
      type: 'span',
      textStyle:
        typeof annotation.data?.textStyle === 'string'
          ? annotation.data.textStyle
          : undefined,
    };
  }

  if (annotation.kind === 'link') {
    const href =
      typeof annotation.data?.href === 'string'
        ? annotation.data.href
        : undefined;

    if (!href) {
      return null;
    }

    return {
      ...base,
      type: 'link',
      href,
      text: passageText.slice(annotation.start, annotation.end),
    };
  }

  if (annotation.kind === 'heading') {
    const level =
      typeof annotation.data?.level === 'number' ? annotation.data.level : 1;
    const headingClass =
      typeof annotation.data?.class === 'string'
        ? annotation.data.class
        : HEADING_CLASS_FALLBACK;

    return {
      ...base,
      type: 'heading',
      level,
      class: headingClass as never,
    };
  }

  return null;
};

export const normalizePassageType = (type: string): BodyItemType => {
  if (type === 'preface') {
    return 'prelude';
  }

  if (type === 'prefaceHeader') {
    return 'preludeHeader';
  }

  if (type === 'acknowledgement') {
    return 'acknowledgment';
  }

  if (type === 'acknowledgementHeader') {
    return 'acknowledgmentHeader';
  }

  return type as BodyItemType;
};

export const previewDtoToPassage = (
  operation: PassageInsertOperation,
): Passage => {
  return {
    uuid: operation.passage.uuid,
    workUuid: operation.passage.workUuid,
    label: operation.passage.label,
    sort: operation.passage.sort,
    type: normalizePassageType(operation.passage.type),
    content: operation.passage.content,
    xmlId: operation.passage.xmlId,
    annotations: operation.annotations
      .map((annotation) =>
        previewAnnotationToAnnotation({
          annotation,
          passageUuid: operation.passage.uuid,
          passageText: operation.passage.content,
        }),
      )
      .filter((annotation): annotation is Annotation => annotation !== null),
  };
};
