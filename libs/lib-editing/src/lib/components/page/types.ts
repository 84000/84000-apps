import { BodyItemType } from '@data-access';

export type EditorBuilderType = BodyItemType | 'titles';

export type EditorToolsType = 'summarizer' | 'bibliography' | 'glossary';

export type EditorMenuItemType = EditorBuilderType | EditorToolsType;
