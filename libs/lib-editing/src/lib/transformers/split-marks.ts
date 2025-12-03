export type TranslationMark = {
  type: string;
  attrs?: {
    start?: number;
    end?: number;
    [key: string]: unknown;
  };
};

export const splitMarks = ({
  marks,
  start,
  end,
}: {
  marks?: TranslationMark[];
  start: number;
  end: number;
}) => {
  if (!marks) {
    return;
  }

  const nextMarks = marks
    .filter(
      (mark) =>
        (mark.attrs?.end ?? 0) <= end && (mark.attrs?.start ?? 0) <= end,
    )
    .map((mark) => {
      const markStart = Math.max(mark.attrs?.start ?? 0, start);
      const markEnd = Math.min(mark.attrs?.end ?? 0, end);
      return {
        ...mark,
        attrs: {
          ...mark.attrs,
          start: markStart,
          end: markEnd,
        },
      };
    });

  return nextMarks;
};
