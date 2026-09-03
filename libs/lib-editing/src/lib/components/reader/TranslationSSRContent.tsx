import type { Extensions, JSONContent } from '@tiptap/core';
import {
  renderTranslationHTML,
  translationPlainText,
} from './translation-html';

type Content = JSONContent | JSONContent[];

type Props = {
  content: Content;
  className?: string;
  extensions?: Extensions;
};

export const TranslationSSRContent = ({
  content,
  className,
  extensions,
}: Props) => {
  const html = renderTranslationHTML({ content, extensions });

  if (html === null) {
    return <div className={className}>{translationPlainText(content)}</div>;
  }

  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
};
