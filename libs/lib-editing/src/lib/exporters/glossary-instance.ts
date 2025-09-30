import { GlossaryInstanceAnnotation } from '@data-access';
import { Exporter } from './export';

export const glossaryInstance: Exporter<GlossaryInstanceAnnotation> = ({
  node,
  start,
  passageUuid,
}): GlossaryInstanceAnnotation | undefined => {
  const textContent = node.textContent;
  const glossary = node.attrs.glossary;
  const uuid = node.attrs.uuid;

  if (!textContent || !glossary) {
    console.warn(`Glossary instance ${uuid} is incomplete`);
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
