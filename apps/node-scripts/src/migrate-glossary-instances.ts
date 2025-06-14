import { loadConfig } from './config';
import { fetchPage } from './fetch';
import { AnnotationTransformer, PassageAnnotationModel } from './types';

const main = async () => {
  const { supabase, pageSize: limit } = loadConfig();
  let lastBatch = Infinity;
  let page = 0;

  while (lastBatch >= limit) {
    console.log(`fetching page ${page}`);

    const { data: paData, error } = await fetchPage({
      supabase,
      limit,
      type: 'glossary-instance',
      contentType: 'glossary_xmlId',
    });

    if (error) {
      console.error(error);
      return;
    }

    lastBatch = paData.length;
    page += 1;

    console.log(`fetched ${lastBatch} records`);

    const annotationData: {
      [key: string]: AnnotationTransformer;
    } = {};
    const xmlIdToAnnotations: { [key: string]: string[] } = {};

    paData.forEach((pa) => {
      const xmlId = pa.xmlId;
      if (!xmlId) {
        return;
      }

      annotationData[pa.annotationUuid] = {
        ...pa,
        targetUuid: '',
      };

      xmlIdToAnnotations[xmlId] = [
        ...(xmlIdToAnnotations[xmlId] || []),
        pa.annotationUuid,
      ];
    });

    const { data: glData, error: glError } = await supabase
      .from('glossaries')
      .select(
        `
      xmlId:glossary_xmlId::text,
      authorityUuid:authority_uuid::text
    `,
      )
      .in('glossary_xmlId', Object.keys(xmlIdToAnnotations));

    if (glError) {
      console.error(glError);
      return;
    }

    glData.forEach(({ xmlId, authorityUuid }) => {
      const annotations = xmlIdToAnnotations[xmlId];
      if (!annotations) {
        return;
      }
      annotations.forEach((annotationUuid) => {
        annotationData[annotationUuid].targetUuid = authorityUuid;
      });
    });

    const keys = Object.keys(annotationData);
    const upsertData: PassageAnnotationModel[] = [];
    for (const uuid of keys) {
      const {
        xmlId,
        targetUuid: authorityUuid,
        passageUuid: passage_uuid,
        createdAt: created_at,
        start,
        end,
        toh,
        passageXmlId: passage_xmlId,
        type,
      } = annotationData[uuid];
      if (!xmlId || !authorityUuid) {
        continue;
      }

      upsertData.push({
        uuid,
        created_at,
        passage_uuid,
        type,
        start,
        end,
        toh,
        passage_xmlId,
        content: [
          {
            glossary_xmlId: xmlId,
            uuid: authorityUuid,
          },
        ],
      });
    }

    console.log(`upserting ${upsertData.length} records`);
    console.log(JSON.stringify(upsertData, null, 2));
    const { error: upsertError } = await supabase
      .from('passage_annotations')
      .upsert(upsertData);

    if (upsertError) {
      console.error(upsertError);
      return;
    }
  }
};

main();
