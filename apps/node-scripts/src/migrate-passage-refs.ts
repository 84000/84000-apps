/**
 * Migration script: Passage Reference (Abbreviation) Annotations
 *
 * This script migrates abbreviation passage annotations to include
 * the passage UUID alongside the existing abbreviation_xmlId.
 *
 * Problem solved:
 * - Annotations originally only stored `abbreviation_xmlId` references
 * - This script restructures the content to include both xmlId and uuid
 *
 * Process:
 * 1. Fetch batches of abbreviation annotations that have xmlId but no uuid
 * 2. Transform the content structure to include the passage uuid
 * 3. Upsert the annotations with the enriched content structure
 *
 * Run: npx ts-node apps/node-scripts/src/migrate-passage-refs.ts
 */

import { loadConfig } from './config';
import { fetchPage } from './fetch';
import { PassageAnnotationModel } from './types';

const ANNOTATION_TYPE = 'abbreviation';
const CONTENT_TYPE = 'abbreviation_xmlId';

const main = async () => {
  const { supabase, pageSize: limit } = loadConfig();
  let lastBatch = Infinity;
  let page = 0;

  while (lastBatch >= limit) {
    console.log(`fetching page ${page}`);

    const { data: paData, error } = await fetchPage({
      supabase,
      limit,
      type: ANNOTATION_TYPE,
      contentType: CONTENT_TYPE,
    });

    if (error) {
      console.error(error);
      return;
    }

    lastBatch = paData.length;
    page += 1;

    console.log(`fetched ${lastBatch} records`);
    const upsertData: PassageAnnotationModel[] = [];
    paData.forEach((pa) => {
      const {
        annotationUuid: uuid,
        xmlId,
        passageUuid: passage_uuid,
        createdAt: created_at,
        start,
        end,
        toh,
        passageXmlId: passage_xmlId,
        type,
      } = pa;

      if (!xmlId || !passage_uuid) {
        return;
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
            abbreviation_xmlId: xmlId,
            uuid: passage_uuid,
          },
        ],
      });
    });

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
