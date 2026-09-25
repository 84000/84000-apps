import type { AnnotationDTO, PassageRowDTO } from '../../types';

export type ExistingPassageRow = PassageRowDTO;

export type ExistingAnnotationRow = AnnotationDTO & {
  passage_uuid: string;
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableStringify(entryValue)}`,
      )
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

const nullableEqual = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);

/** Whether a passage row differs from what is stored, so needs writing. */
export const passageRowHasChanged = (
  incoming: PassageRowDTO,
  existing?: ExistingPassageRow,
) => {
  if (!existing) {
    return true;
  }

  return (
    incoming.content !== existing.content ||
    incoming.label !== existing.label ||
    incoming.sort !== existing.sort ||
    incoming.type !== existing.type ||
    incoming.work_uuid !== existing.work_uuid ||
    !nullableEqual(incoming.xmlId, existing.xmlId) ||
    !nullableEqual(incoming.parent, existing.parent) ||
    stableStringify(incoming.toh ?? null) !==
      stableStringify(existing.toh ?? null)
  );
};

/** Whether an annotation differs from what is stored, so needs writing. */
export const annotationHasChanged = (
  incoming: AnnotationDTO,
  existing?: ExistingAnnotationRow,
) => {
  if (!existing) {
    return true;
  }

  return (
    incoming.start !== existing.start ||
    incoming.end !== existing.end ||
    incoming.type !== existing.type ||
    (incoming.passage_uuid ?? incoming.passageUuid ?? '') !==
      existing.passage_uuid ||
    stableStringify(incoming.content ?? []) !==
      stableStringify(existing.content ?? []) ||
    stableStringify(incoming.toh ?? null) !==
      stableStringify(existing.toh ?? null)
  );
};
