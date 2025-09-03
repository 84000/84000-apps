export const SLUGS = ['basic'];
export type Slug = (typeof SLUGS)[number];

export const FORMATS = ['json', 'passages', 'html', 'text'] as const;
export type Format = (typeof FORMATS)[number];

export const EDITORS = ['translation', 'block'];
export type EditorType = (typeof EDITORS)[number];
