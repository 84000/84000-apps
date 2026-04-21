import { storageBucketExists } from './storage';
import { DataClient, DOCX_IMPORT_BUCKET } from './types';

export const assertDocxImportBucketReady = async ({
  client,
}: {
  client: DataClient;
}) => {
  const exists = await storageBucketExists({
    client,
    bucket: DOCX_IMPORT_BUCKET,
  });

  if (!exists) {
    throw new Error(
      `Storage bucket "${DOCX_IMPORT_BUCKET}" was not found. Create it in the Supabase console before using the DOCX import flow.`,
    );
  }
};
