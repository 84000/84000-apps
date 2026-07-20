import { DataClient } from './types';

export const uploadToStorage = async ({
  client,
  bucket,
  path,
  file,
}: {
  client: DataClient;
  bucket: string;
  path: string;
  file: File;
}) => {
  const { error } = await client.storage.from(bucket).upload(path, file);

  if (error) {
    console.error('Error uploading to storage:', error);
    return null;
  }

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};
