import { lookupEntity } from '@data-access/ssr';
import { notFound, redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: entity } = await params;
  const query = request.nextUrl.searchParams;
  const xmlId = query.get('xmlId') || undefined;
  const path = await lookupEntity({
    type: 'translation',
    entity,
    xmlId,
  });

  if (!path) {
    return notFound();
  }

  redirect(path);
}

export const revalidate = 3600;
