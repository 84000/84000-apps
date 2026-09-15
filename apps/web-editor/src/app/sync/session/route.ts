import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * DEV-707 spike route. Hands the `/sync` sandbox a local editor token and a
 * shared passage to co-edit.
 *
 * It exists because there is no other way for an agent or a developer to get an
 * authenticated browser session against the local stack: `web-main`'s login is
 * social-only (`EMAIL_AUTH_ENABLED` is hard-coded false), so no local sign-in
 * flow exists to click through. Rather than weaken RLS for the sandbox, this
 * mints a token the real policies accept, so the page exercises the genuine
 * permission path.
 *
 * Refuses to run against anything but a loopback Supabase URL — see below. This
 * whole route is spike scaffolding and goes away with the sandbox.
 */

const SANDBOX_LABEL = 'dev-707-sync-sandbox';

const isLocalStack = (url: string): boolean => {
  try {
    const { hostname } = new URL(url);
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  } catch {
    return false;
  }
};

const base64Url = (input: Buffer | string): string =>
  (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;

  // Hard stop rather than a warning. This endpoint mints an admin token from a
  // shared secret; pointed at a deployed project it would be an open door, and
  // a sandbox route is exactly the kind of thing that gets deployed by accident.
  if (!supabaseUrl || !isLocalStack(supabaseUrl)) {
    return NextResponse.json(
      {
        error:
          'The DEV-707 sync sandbox only runs against a local Supabase stack. ' +
          `NEXT_PUBLIC_SUPABASE_URL is ${supabaseUrl ?? 'unset'}.`,
      },
      { status: 403 },
    );
  }

  if (!anonKey || !serviceKey || !jwtSecret) {
    return NextResponse.json(
      {
        error:
          'Set NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and ' +
          'SUPABASE_JWT_SECRET in apps/web-editor/.env.local (see `supabase status`).',
      },
      { status: 500 },
    );
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // One stable passage, reused across tabs and reloads, so two windows land on
  // the same document without coordinating through the URL.
  const existing = await service
    .from('passages')
    .select('uuid, work_uuid')
    .eq('label', SANDBOX_LABEL)
    .limit(1)
    .maybeSingle();

  let passageUuid = existing.data?.uuid as string | undefined;
  let workUuid = existing.data?.work_uuid as string | undefined;

  if (!passageUuid) {
    const work = await service.from('works').select('uuid').limit(1).single();
    if (work.error || !work.data) {
      return NextResponse.json(
        { error: `No works in the local database: ${work.error?.message}` },
        { status: 500 },
      );
    }

    const created = await service
      .from('passages')
      .insert({
        work_uuid: work.data.uuid,
        type: 'paragraph',
        label: SANDBOX_LABEL,
        content: '',
      })
      .select('uuid, work_uuid')
      .single();

    if (created.error || !created.data) {
      return NextResponse.json(
        { error: `Could not create the sandbox passage: ${created.error?.message}` },
        { status: 500 },
      );
    }

    passageUuid = created.data.uuid;
    workUuid = created.data.work_uuid;
  }

  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      iss: 'supabase-demo',
      role: 'authenticated',
      aud: 'authenticated',
      sub: '00000000-0000-4000-8000-000000000001',
      user_role: 'admin',
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  const signature = base64Url(
    createHmac('sha256', jwtSecret).update(`${header}.${payload}`).digest(),
  );

  return NextResponse.json({
    supabaseUrl,
    anonKey,
    token: `${header}.${payload}.${signature}`,
    workUuid,
    passageUuid,
  });
}
