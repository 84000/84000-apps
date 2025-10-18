import { GlossaryInstanceAnnotation } from '@data-access';
import { Exporter } from './export';

export const glossaryInstance: Exporter<GlossaryInstanceAnnotation> = ({
  mark,
  node,
  start,
  passageUuid,
}): GlossaryInstanceAnnotation | undefined => {
  const textContent = node.textContent;
  const glossary = mark?.attrs.glossary;
  const uuid = mark?.attrs.uuid;

  if (!textContent || !glossary || !uuid) {
    console.warn(
      `Glossary instance ${uuid} on pasage ${passageUuid} is incomplete`,
    );
    return undefined;
  }

  return {
    uuid,
    type: 'glossaryInstance',
    passageUuid,
    start,
    end: start + textContent.length,
    glossary,
  };
};
