import type { AnnotationDTO, Passage } from '../../types';

/** A save's input. */
export type SaveInput = {
  passages: Passage[];
  deletedUuids: string[];
  rawAnnotations?: Record<string, AnnotationDTO[]>;
  keepAnnotationUuids?: readonly string[];
};

/** A save's input, checked and with each annotation's passage filled in. */
export type ValidatedSave = {
  passages: Passage[];
  deletedUuids: string[];
  /** The raw annotation rows, every passage's together. */
  annotationRows: AnnotationDTO[];
  /** Passages whose full annotation state is in `annotationRows`. */
  rawPassageUuids: Set<string>;
  keepAnnotationUuids: string[];
};

const firstDuplicate = (values: readonly string[]) => {
  const seen = new Set<string>();
  return values.find((value) => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  });
};

/**
 * Checks a save's input before anything is read or written: every passage
 * and annotation once, no passage both saved and deleted, every annotation
 * on a passage in the save, a passage's annotations sent one way only and
 * raw ones complete, and none both sent and kept as stored.
 */
export const validateSave = ({
  passages,
  deletedUuids,
  rawAnnotations = {},
  keepAnnotationUuids = [],
}: SaveInput): ValidatedSave | { error: string } => {
  const reject = (reason: string) => ({
    error: `Invalid save, nothing was saved: ${reason}`,
  });

  const passageUuids = passages.map((passage) => passage.uuid);
  const duplicatePassage = firstDuplicate(passageUuids);
  if (duplicatePassage) {
    return reject(`passage ${duplicatePassage} is sent more than once`);
  }
  const saved = new Set(passageUuids);
  const deleted = [...new Set(deletedUuids)];
  const savedAndDeleted = deleted.find((uuid) => saved.has(uuid));
  if (savedAndDeleted) {
    return reject(`passage ${savedAndDeleted} is both saved and deleted`);
  }

  let mismatch: string | undefined;
  const filled = passages.map((passage) => ({
    ...passage,
    annotations: passage.annotations.map((annotation) => {
      if (!annotation.passageUuid) {
        return { ...annotation, passageUuid: passage.uuid };
      }
      if (annotation.passageUuid !== passage.uuid && !mismatch) {
        mismatch = `annotation ${annotation.uuid} names passage ${annotation.passageUuid} but is sent with ${passage.uuid}`;
      }
      return annotation;
    }),
  }));
  if (mismatch) return reject(mismatch);

  const rawPassageUuids = new Set(Object.keys(rawAnnotations));
  const stray = [...rawPassageUuids].find((uuid) => !saved.has(uuid));
  if (stray) {
    return reject(
      `raw annotations are sent for passage ${stray}, which is not in the save`,
    );
  }
  const both = filled.find(
    (passage) =>
      rawPassageUuids.has(passage.uuid) && passage.annotations.length > 0,
  );
  if (both) {
    return reject(
      `passage ${both.uuid} sends both annotations and raw annotations`,
    );
  }
  const partial = filled.find(
    (passage) =>
      rawPassageUuids.has(passage.uuid) && passage.annotationsIncomplete,
  );
  if (partial) {
    return reject(
      `passage ${partial.uuid} sends raw annotations but marks them incomplete`,
    );
  }
  let misfiled: string | undefined;
  const rows = Object.entries(rawAnnotations).flatMap(([passageUuid, list]) =>
    list.map((row) => {
      const named = [row.passage_uuid, row.passageUuid].find(
        (uuid) => uuid && uuid !== passageUuid,
      );
      if (named && !misfiled) {
        misfiled = `annotation ${row.uuid} names passage ${named} but is sent with ${passageUuid}`;
      }
      return { ...row, passage_uuid: passageUuid };
    }),
  );
  if (misfiled) return reject(misfiled);

  const sentAnnotations = [
    ...filled.flatMap((passage) => passage.annotations.map((a) => a.uuid)),
    ...rows.map((row) => row.uuid),
  ];
  const duplicateAnnotation = firstDuplicate(sentAnnotations);
  if (duplicateAnnotation) {
    return reject(`annotation ${duplicateAnnotation} is sent more than once`);
  }
  const keep = new Set(keepAnnotationUuids);
  const sentAndKept = sentAnnotations.find((uuid) => keep.has(uuid));
  if (sentAndKept) {
    return reject(`annotation ${sentAndKept} is both sent and kept as stored`);
  }

  return {
    passages: filled,
    deletedUuids: deleted,
    annotationRows: rows,
    rawPassageUuids,
    keepAnnotationUuids: [...keep],
  };
};
