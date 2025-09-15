export type EditorBuilderType =
  | 'titles'
  | 'summary'
  | 'acknowledgements'
  | 'introduction'
  | 'body'
  | 'end-notes'
  | 'bibliography'
  | 'glossary';

export type EditorToolsType = 'summarizer';

export type EditorMenuItemType = EditorBuilderType | EditorToolsType;
