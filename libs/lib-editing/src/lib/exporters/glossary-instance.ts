import { GlossaryInstanceAnnotation } from '@eightyfourthousand/data-access';
import { Exporter } from './export';

export const glossaryInstance: Exporter<GlossaryInstanceAnnotation> = ({
  mark,
  node,
  start,
  passageUuid,
}): GlossaryInstanceAnnotation | undefined => {
  const textContent = node.textContent;
  const authority = mark?.attrs.authority;
  const glossary = mark?.attrs.glossary;
  const uuid = mark?.attrs.uuid;

  if (!textContent || !glossary || !authority || !uuid) {
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
    authority,
    glossary,
  };
};
