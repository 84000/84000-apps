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
      type: 'end-note-link',
      contentIndex: 1,
      contentType: 'endnote_xmlId',
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
      .from('passages')
      .select(
        `
      xmlId:"xmlId"::text,
      endNoteUuid:uuid::text
    `,
      )
      .in('xmlId', Object.keys(xmlIdToAnnotations));

    if (glError) {
      console.error(glError);
      return;
    }

    glData.forEach(({ xmlId, endNoteUuid }) => {
      const annotations = xmlIdToAnnotations[xmlId];
      if (!annotations) {
        return;
      }
      annotations.forEach((annotationUuid) => {
        annotationData[annotationUuid].targetUuid = endNoteUuid;
      });
    });

    const keys = Object.keys(annotationData);
    const upsertData: PassageAnnotationModel[] = [];
    for (const uuid of keys) {
      const {
        xmlId,
        targetUuid: endNoteUuid,
        passageUuid: passage_uuid,
        createdAt: created_at,
        start,
        end,
        toh,
        passageXmlId: passage_xmlId,
        type,
      } = annotationData[uuid];
      if (!xmlId || !endNoteUuid) {
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
            endnote_xmlId: xmlId,
            uuid: endNoteUuid,
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
