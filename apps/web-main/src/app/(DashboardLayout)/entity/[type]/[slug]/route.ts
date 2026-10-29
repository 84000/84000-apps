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
  // through harmlessly.
  const { path } = await lookupEntity({
    type,
    entity,
    searchParams,
    prefix: '/translations/editor',
  });

  if (!path) {
    return notFound();
  }

  redirect(path);
}
