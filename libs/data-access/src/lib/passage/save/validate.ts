import type { AnnotationDTO, Passage } from '../../types';

/** A save's input, checked and with each annotation's passage filled in. */
export type ValidatedSave = {
  passages: Passage[];
  deletedUuids: string[];
  annotationRows: AnnotationDTO[];
  keepAnnotationUuids?: readonly string[];
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
 * on a passage in the save, and none both sent and kept as stored.
 */
export const validateSave = ({
  passages,
  deletedUuids,
  annotationRows,
  keepAnnotationUuids = [],
}: ValidatedSave): ValidatedSave | { error: string } => {
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

  let stray: string | undefined;
  const rows = annotationRows.map((row) => {
    const passageUuid = row.passage_uuid ?? row.passageUuid ?? '';
    if (!saved.has(passageUuid) && !stray) {
      stray = `annotation ${row.uuid} is on passage ${passageUuid || '(none)'}, which is not in the save`;
    }
    return { ...row, passage_uuid: passageUuid };
  });
  if (stray) return reject(stray);

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
    keepAnnotationUuids: [...keep],
  };
};
