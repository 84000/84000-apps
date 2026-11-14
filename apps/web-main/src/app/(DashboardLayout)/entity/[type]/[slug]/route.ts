import { contentSourceFromEnv } from '@eightyfourthousand/data-access';
import { lookupEntity } from '@eightyfourthousand/data-access/ssr';
import { notFound, redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; slug: string }> },
) {
  const { type, slug: entity } = await params;
  const {
    nextUrl: { searchParams },
  } = request;

  // Everyone lands in the editor. `edit=true` from older links is carried
  // through harmlessly. The studio's source is draft, so a child glossary uuid
  // still resolves to its entry; the published copy cannot resolve one.
  const { path } = await lookupEntity({
    type,
    entity,
    searchParams,
    prefix: '/translations/editor',
    source: contentSourceFromEnv(),
  });

  if (!path) {
    return notFound();
  }

  redirect(path);
}
