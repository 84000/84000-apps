export const PASSAGE_WRAPPER_CLASS =
  'flex md:flex-row flex-col w-full md:gap-10 gap-2 scroll-mt-20';

export const PASSAGE_INNER_CLASS = 'relative scroll-m-20 w-full self-start';

// `select-none`: the label is chrome, so a drag through a passage should not
// paint it as selected. It does not decide what a copy carries — the per-tab
// editor serializes from the document, not from the selected DOM.
export const PASSAGE_LABEL_CLASS =
  'absolute labeled -left-16 w-16 text-end hover:cursor-pointer select-none';

export const PASSAGE_CONTENT_CLASS = 'passage is-editable pl-6 @c/sidebar:pl-4';

export const PASSAGE_REFERENCES_CLASS = 'pl-6 @c/sidebar:pl-4 mt-1';
