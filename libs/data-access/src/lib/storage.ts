import { DataClient } from './types';

export const SIGNED_UPLOAD_EXPIRY_SECONDS = 60 * 60 * 2; // 2 hours

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

export const createSignedUploadUrl = async ({
  client,
  bucket,
  path,
}: {
  client: DataClient;
  bucket: string;
  path: string;
}) => {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error) {
    console.error('Failed to create signed upload URL:', error);
    return null;
  }

  return data;
};

export const downloadFromStorage = async ({
  client,
  bucket,
  path,
}: {
  client: DataClient;
  bucket: string;
  path: string;
}) => {
  const { data, error } = await client.storage.from(bucket).download(path);

  if (error) {
    console.error('Failed to download from storage:', error);
    return null;
  }

  return data;
};

export const pathExistsInStorage = async ({
  client,
  bucket,
  path,
}: {
  client: DataClient;
  bucket: string;
  path: string;
}) => {
  const { error, data: exists } = await client.storage
    .from(bucket)
    .exists(path);

  if (error) {
    console.error('Error checking file existence in storage:', error);
    return false;
  }

  return exists;
};

export const storageBucketExists = async ({
  client,
  bucket,
}: {
  client: DataClient;
  bucket: string;
}) => {
  const { error } = await client.storage.from(bucket).list('', {
    limit: 1,
  });

  if (error) {
    console.error(`Failed to access storage bucket "${bucket}":`, error);
    return false;
  }

  return true;
};
