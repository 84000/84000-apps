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

  const isEditor = searchParams.get('edit') === 'true';
  const prefix = isEditor ? '/translations/editor' : '/translations/reader';

  const path = await lookupEntity({
    type,
    entity,
    searchParams,
    prefix,
  });

  if (!path) {
    return notFound();
  }

  redirect(path);
}

export const revalidate = 3600;
