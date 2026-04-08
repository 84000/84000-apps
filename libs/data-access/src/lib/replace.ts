import type { Annotation, Passage } from './types';

export interface PassageOccurrence {
  end: number;
  index: number;
  passageOccurrenceIndex: number;
  passageUuid: string;
  start: number;
}

export interface PassageReplacementResult {
  deletedAnnotationCount: number;
  nextSearchStart?: number;
  passage: Passage;
  replacementsApplied: number;
  updatedAnnotationCount: number;
}

interface RemapAnnotationsResult {
  annotations: Annotation[];
  deletedAnnotationCount: number;
  updatedAnnotationCount: number;
}

export const findLiteralOccurrences = (
  content: string,
  searchText: string,
): Array<{ end: number; start: number }> => {
  if (!searchText) {
    return [];
  }

  const matches: Array<{ end: number; start: number }> = [];
  let fromIndex = 0;

  while (fromIndex <= content.length - searchText.length) {
    const start = content.indexOf(searchText, fromIndex);
    if (start === -1) {
      break;
    }

    matches.push({
      start,
      end: start + searchText.length,
    });
    fromIndex = start + searchText.length;
  }

  return matches;
};

export const getPassageOccurrences = (
  passages: Pick<Passage, 'content' | 'uuid'>[],
  searchText: string,
): PassageOccurrence[] => {
  let index = 0;

  return passages.flatMap((passage) =>
    findLiteralOccurrences(passage.content, searchText).map((match, passageIndex) => ({
      ...match,
      index: index++,
      passageOccurrenceIndex: passageIndex,
      passageUuid: passage.uuid,
    })),
  );
};

const mapEditPosition = ({
  delta,
  editEnd,
  editStart,
  position,
  replacementLength,
  stickTo,
}: {
  delta: number;
  editEnd: number;
  editStart: number;
  position: number;
  replacementLength: number;
  stickTo: 'end' | 'start';
}) => {
  if (position <= editStart) {
    return position;
  }

  if (position >= editEnd) {
    return position + delta;
  }

  return stickTo === 'start' ? editStart : editStart + replacementLength;
};

const remapAnnotationsForEdit = ({
  annotations,
  editEnd,
  editStart,
  replacementLength,
}: {
  annotations: Annotation[];
  editEnd: number;
  editStart: number;
  replacementLength: number;
}): RemapAnnotationsResult => {
  const delta = replacementLength - (editEnd - editStart);
  const nextAnnotations: Annotation[] = [];
  let deletedAnnotationCount = 0;
  let updatedAnnotationCount = 0;

  for (const annotation of annotations) {
    if (annotation.end <= editStart) {
      nextAnnotations.push(annotation);
      continue;
    }

    if (annotation.start >= editEnd) {
      nextAnnotations.push({
        ...annotation,
        start: annotation.start + delta,
        end: annotation.end + delta,
      });
      updatedAnnotationCount++;
      continue;
    }

    const nextStart = mapEditPosition({
      delta,
      editEnd,
      editStart,
      position: annotation.start,
      replacementLength,
      stickTo: 'start',
    });
    const nextEnd = mapEditPosition({
      delta,
      editEnd,
      editStart,
      position: annotation.end,
      replacementLength,
      stickTo: 'end',
    });

    if (nextStart === nextEnd && replacementLength === 0) {
      deletedAnnotationCount++;
      continue;
    }

    if (nextStart !== annotation.start || nextEnd !== annotation.end) {
      updatedAnnotationCount++;
      nextAnnotations.push({
        ...annotation,
        start: nextStart,
        end: nextEnd,
      });
      continue;
    }

    nextAnnotations.push(annotation);
  }

  return {
    annotations: nextAnnotations,
    deletedAnnotationCount,
    updatedAnnotationCount,
  };
};

export const replacePassageText = ({
  occurrenceIndex,
  passage,
  replaceText,
  searchText,
}: {
  occurrenceIndex?: number;
  passage: Passage;
  replaceText: string;
  searchText: string;
}): PassageReplacementResult => {
  if (!searchText || occurrenceIndex === null) {
    return {
      passage,
      replacementsApplied: 0,
      updatedAnnotationCount: 0,
      deletedAnnotationCount: 0,
    };
  }

  const matches = findLiteralOccurrences(passage.content, searchText);
  const matchesToApply =
    occurrenceIndex === undefined
      ? matches
      : matches.filter((_, index) => index === occurrenceIndex);

  if (matchesToApply.length === 0) {
    return {
      passage,
      replacementsApplied: 0,
      updatedAnnotationCount: 0,
      deletedAnnotationCount: 0,
    };
  }

  let content = passage.content;
  let annotations = passage.annotations.map((annotation) => ({ ...annotation }));
  let cumulativeDelta = 0;
  let updatedAnnotationCount = 0;
  let deletedAnnotationCount = 0;
  let nextSearchStart: number | undefined;

  for (const match of matchesToApply) {
    const editStart = match.start + cumulativeDelta;
    const editEnd = match.end + cumulativeDelta;

    content =
      content.slice(0, editStart) + replaceText + content.slice(editEnd);

    const remappedAnnotations = remapAnnotationsForEdit({
      annotations,
      editStart,
      editEnd,
      replacementLength: replaceText.length,
    });

    annotations = remappedAnnotations.annotations;
    updatedAnnotationCount += remappedAnnotations.updatedAnnotationCount;
    deletedAnnotationCount += remappedAnnotations.deletedAnnotationCount;
    nextSearchStart = editStart + replaceText.length;
    cumulativeDelta += replaceText.length - (match.end - match.start);
  }

  return {
    passage: {
      ...passage,
      content,
      annotations,
    },
    nextSearchStart,
    replacementsApplied: matchesToApply.length,
    updatedAnnotationCount,
    deletedAnnotationCount,
  };
};
