import { DataClient } from './types';
import {
  ARCHIVE_PREFIX,
  archiveIfPresent,
  contentTypeFor,
  isNotFound,
  isTextPath,
  listObjects,
} from './storage-archive';

/**
 * The working documents of an agentic translation session — Stage 0 records,
 * Stage 1 drafts, collation reports, alignment records. Private bucket, gated on
 * `harness.read` / `harness.edit`; RLS is the authority, nothing here.
 */
export const SESSIONS_BUCKET = 'translation-sessions';

export const SESSIONS_ARCHIVE_PREFIX = ARCHIVE_PREFIX;

export const SESSION_STAGES = ['stage0', 'stage1'] as const;
export type SessionStage = (typeof SESSION_STAGES)[number];

/** The name a manifest is always written under, one per work and stage. */
export const MANIFEST_FILENAME = 'manifest.json';

/** How long a signed download URL stays usable, in seconds. */
const DOWNLOAD_URL_TTL = 60 * 60;

/**
 * `toh345/stage1/toh345_stage1.docx` — work, then stage, then the filename the
 * skill already generated. Nothing is renamed at this boundary.
 *
 * One live copy per path, so two translators drafting the same work and stage
 * would archive over each other. Concurrent independent drafts are a deliberate
 * non-goal; a run identifier in the path is the escape hatch if they become real.
 */
export const sessionPath = ({
  toh,
  stage,
  filename,
}: {
  toh: string;
  stage: SessionStage;
  filename: string;
}) => `${toh}/${stage}/${filename}`;

const sessionPrefix = ({
  toh,
  stage,
}: {
  toh: string;
  stage?: SessionStage;
}) => (stage ? `${toh}/${stage}` : toh);

/**
 * A path segment may not steer a write out of its own work and stage folder.
 * The paths are assembled here, but `toh` and the filename both arrive from the
 * agent.
 */
const isSafeSegment = (segment: string) =>
  segment.length > 0 &&
  !segment.includes('/') &&
  !segment.includes('\\') &&
  segment !== '.' &&
  segment !== '..';

/**
 * Names that would steer a write outside its own work and stage folder. A work
 * called `archive` is refused too: live objects under the append-only prefix
 * could never be removed by anything but `service_role`.
 */
export const invalidSessionNames = ({
  toh,
  filenames = [],
}: {
  toh: string;
  filenames?: string[];
}) => {
  const invalid = [toh, ...filenames].filter((name) => !isSafeSegment(name));
  if (isSafeSegment(toh) && toh === SESSIONS_ARCHIVE_PREFIX) invalid.push(toh);
  return invalid;
};

/**
 * Names the agent may not write, though it may read them. The manifest is
 * written by the server precisely so its identity and timestamp are not the
 * agent's to assert; handing out an upload URL for it would give that back.
 */
export const reservedWriteNames = (filenames: string[]) =>
  filenames.filter((filename) => filename === MANIFEST_FILENAME);

/** Lists the live document paths for a work, or for one stage of it. */
export const listSessionDocuments = async ({
  client,
  toh,
  stage,
}: {
  client: DataClient;
  toh: string;
  stage?: SessionStage;
}) =>
  listObjects({
    client,
    bucket: SESSIONS_BUCKET,
    prefix: sessionPrefix({ toh, stage }),
    skip: [SESSIONS_ARCHIVE_PREFIX],
  });

export type SessionDocument = {
  path: string;
  filename: string;
  contentType: string;
} & ({ content: string } | { downloadUrl: string });

/**
 * Reads are asymmetric on purpose. Markdown and JSON come back inline, because
 * reading the Stage 0 record before drafting is the whole point. A `.docx` comes
 * back as a signed download URL — its bytes are no use to a model, and the
 * client fetches it to disk.
 */
export const readSessionDocument = async ({
  client,
  path,
}: {
  client: DataClient;
  path: string;
}): Promise<SessionDocument | undefined> => {
  const bucket = client.storage.from(SESSIONS_BUCKET);
  const filename = path.slice(path.lastIndexOf('/') + 1);
  const contentType = contentTypeFor(path);

  if (!isTextPath(path)) {
    const { data, error } = await bucket.createSignedUrl(
      path,
      DOWNLOAD_URL_TTL,
    );
    if (error || !data) {
      if (!isNotFound(error)) {
        console.error(`Error signing ${path}:`, error?.message);
      }
      return undefined;
    }
    return { path, filename, contentType, downloadUrl: data.signedUrl };
  }

  const { data, error } = await bucket.download(path);
  if (error || !data) {
    // A document that has not been written yet is reported by the caller as
    // `missing`, so only a real failure earns a log line.
    if (!isNotFound(error)) {
      console.error(`Error reading ${path}:`, error?.message);
    }
    return undefined;
  }

  return { path, filename, contentType, content: await data.text() };
};

/** Resolves each path independently, reporting the ones that did not resolve. */
export const readSessionDocuments = async ({
  client,
  paths,
}: {
  client: DataClient;
  paths: string[];
}) => {
  const results = await Promise.all(
    paths.map((path) => readSessionDocument({ client, path })),
  );

  const documents = results.filter((d): d is SessionDocument => !!d);
  const missing = paths.filter((_, i) => !results[i]);
  return { documents, missing };
};

export type SessionUpload = {
  path: string;
  filename: string;
  contentType: string;
  uploadUrl: string;
  token: string;
  archivedPath?: string;
};

/**
 * Archives whatever each path currently holds, then issues one signed upload URL
 * per path. The bytes are PUT by the client after this returns, so the archive
 * cannot happen at the moment of replacement the way a text write does — every
 * archive is taken first, and no URL is issued at all unless all of them
 * succeeded. The cost is that a client which never PUTs leaves an archived copy
 * of an unchanged file behind; that is accepted noise, and cheaper than moving
 * hundreds of kilobytes of base64 through a model's context.
 *
 * A signed URL is an unauthenticated write capability for its lifetime — two
 * hours, fixed by storage — scoped to exactly one path, so one is issued only
 * per path actually being written.
 */
export const prepareSessionUploads = async ({
  client,
  paths,
  at = new Date(),
}: {
  client: DataClient;
  paths: string[];
  at?: Date;
}): Promise<{ uploads?: SessionUpload[]; error?: string }> => {
  const archived: Record<string, string | undefined> = {};

  for (const path of paths) {
    const archive = await archiveIfPresent({
      client,
      bucket: SESSIONS_BUCKET,
      path,
      at,
    });
    if (archive.error) {
      return { error: `${archive.error}; no upload was authorized.` };
    }
    archived[path] = archive.archivedPath;
  }

  const uploads: SessionUpload[] = [];
  for (const path of paths) {
    const { data, error } = await client.storage
      .from(SESSIONS_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !data) {
      return {
        error: `Could not authorize an upload for ${path} (${error?.message}).`,
      };
    }

    uploads.push({
      path,
      filename: path.slice(path.lastIndexOf('/') + 1),
      contentType: contentTypeFor(path),
      uploadUrl: data.signedUrl,
      token: data.token,
      ...(archived[path] ? { archivedPath: archived[path] } : {}),
    });
  }

  return { uploads };
};

export type ManifestFile = {
  filename: string;
  contentType: string;
  role: 'primary' | 'supporting';
};

export type SessionManifest = {
  toh: string;
  workUuid?: string;
  stage: SessionStage;
  files: ManifestFile[];
  model?: { name: string; version?: string };
  userUuid: string;
  timestamp: string;
};

/**
 * Writes the manifest describing one run of a stage. It is small text, so it
 * goes straight in rather than through a signed URL — which is also what keeps
 * `userUuid` and `timestamp` honest: they are stamped here from the verified
 * token and the server clock, never taken from the agent.
 */
export const writeSessionManifest = async ({
  client,
  toh,
  workUuid,
  stage,
  files,
  model,
  userUuid,
  at = new Date(),
}: {
  client: DataClient;
  toh: string;
  workUuid?: string;
  stage: SessionStage;
  files: ManifestFile[];
  model?: { name: string; version?: string };
  userUuid: string;
  at?: Date;
}): Promise<{ path?: string; manifest?: SessionManifest; error?: string }> => {
  const path = sessionPath({ toh, stage, filename: MANIFEST_FILENAME });

  const archive = await archiveIfPresent({
    client,
    bucket: SESSIONS_BUCKET,
    path,
    at,
  });
  if (archive.error) {
    return { error: `${archive.error}; the manifest was not written.` };
  }

  const manifest: SessionManifest = {
    toh,
    ...(workUuid ? { workUuid } : {}),
    stage,
    files,
    ...(model ? { model } : {}),
    userUuid,
    timestamp: at.toISOString(),
  };

  const { error } = await client.storage
    .from(SESSIONS_BUCKET)
    .upload(path, new Blob([JSON.stringify(manifest, null, 2)]), {
      upsert: true,
      contentType: contentTypeFor(path),
    });

  if (error) {
    return { error: `Could not write the manifest (${error.message}).` };
  }

  return { path, manifest };
};
