import { DataClient, normalizeToh } from './types';
import type { TohokuCatalogEntry } from './types';
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
  toh: TohokuCatalogEntry;
  stage: SessionStage;
  filename: string;
}) => `${toh}/${stage}/${filename}`;

const sessionPrefix = ({
  toh,
  stage,
}: {
  toh: TohokuCatalogEntry;
  stage?: SessionStage;
}) => (stage ? `${toh}/${stage}` : toh);

/**
 * The canonical key for a work's folder, or `undefined` when the number is not
 * one. Callers must resolve this before building a path: `toh` reaches these
 * functions from a model on every call, and storage keys are case-sensitive, so
 * an unnormalized `Toh345` would silently open a second folder beside `toh345`.
 *
 * Normalizing is also what makes the folder name safe. The result always has
 * the shape `toh<number>`, so it can carry no separator and can never collide
 * with the append-only `archive` prefix.
 */
export const sessionToh = (input: string) => normalizeToh(input);

/** Filenames that would steer a write out of its own work and stage folder. */
export const invalidSessionFilenames = (filenames: string[]) =>
  filenames.filter(
    (name) =>
      !name ||
      name.includes('/') ||
      name.includes('\\') ||
      name === '.' ||
      name === '..',
  );

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
  toh: TohokuCatalogEntry;
  stage?: SessionStage;
}) =>
  listObjects({
    client,
    bucket: SESSIONS_BUCKET,
    prefix: sessionPrefix({ toh, stage }),
  });

export type SessionDocument = {
  path: string;
  filename: string;
  contentType: string;
} & ({ content: string } | { downloadUrl: string });

/**
 * The outcome of a read. Absence and failure are kept apart deliberately: a
 * Stage 1 session that reads a transient storage error as "the Stage 0 record
 * was never saved" would re-draft from scratch and discard the previous
 * session's work.
 */
export type SessionRead =
  | { document: SessionDocument }
  | { missing: true }
  | { error: string };

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
}): Promise<SessionRead> => {
  const bucket = client.storage.from(SESSIONS_BUCKET);
  const filename = path.slice(path.lastIndexOf('/') + 1);
  const contentType = contentTypeFor(path);

  if (!isTextPath(path)) {
    const { data, error } = await bucket.createSignedUrl(
      path,
      DOWNLOAD_URL_TTL,
    );
    if (error || !data) {
      if (isNotFound(error)) return { missing: true };
      console.error(`Error signing ${path}:`, error?.message);
      return { error: error?.message ?? `Could not sign ${path}.` };
    }
    return {
      document: { path, filename, contentType, downloadUrl: data.signedUrl },
    };
  }

  const { data, error } = await bucket.download(path);
  if (error || !data) {
    if (isNotFound(error)) return { missing: true };
    console.error(`Error reading ${path}:`, error?.message);
    return { error: error?.message ?? `Could not read ${path}.` };
  }

  return {
    document: { path, filename, contentType, content: await data.text() },
  };
};

/**
 * Resolves each path independently, separating the ones that are not there from
 * the ones that could not be read.
 */
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

  const documents: SessionDocument[] = [];
  const missing: string[] = [];
  const failed: { path: string; error: string }[] = [];

  results.forEach((result, i) => {
    if ('document' in result) documents.push(result.document);
    else if ('missing' in result) missing.push(paths[i]);
    else failed.push({ path: paths[i], error: result.error });
  });

  return { documents, missing, failed };
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
 * Reads the manifest a previous save left, so a new one can carry its files
 * forward. A manifest that is absent or unreadable yields no files rather than
 * failing the save: losing provenance is bad, but refusing the write is worse.
 */
const previousManifestFiles = async ({
  client,
  path,
}: {
  client: DataClient;
  path: string;
}): Promise<ManifestFile[]> => {
  const read = await readSessionDocument({ client, path });
  if (!('document' in read) || !('content' in read.document)) return [];

  try {
    const files = (JSON.parse(read.document.content) as SessionManifest).files;
    return Array.isArray(files) ? files : [];
  } catch {
    return [];
  }
};

/**
 * Writes the manifest describing a stage. It is small text, so it goes straight
 * in rather than through a signed URL — which is also what keeps `userUuid` and
 * `timestamp` honest: they are stamped here from the verified token and the
 * server clock, never taken from the agent.
 *
 * There is one manifest per work and stage, and a stage's files can be saved
 * across more than one call, so files already recorded are carried forward and
 * only the ones named again are replaced. Otherwise a second call would leave
 * the first call's files live in storage with no record of who produced them.
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
  toh: TohokuCatalogEntry;
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

  const named = new Set(files.map((f) => f.filename));
  const carried = (await previousManifestFiles({ client, path })).filter(
    (f) => !named.has(f.filename),
  );

  const manifest: SessionManifest = {
    toh,
    ...(workUuid ? { workUuid } : {}),
    stage,
    files: [...carried, ...files].sort((a, b) =>
      a.filename.localeCompare(b.filename),
    ),
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
