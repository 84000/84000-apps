import { lookupEntity } from '@data-access/ssr';
import { notFound, redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const { slug } = await Promise.resolve(params);
  const query = request.nextUrl.searchParams;
  const xmlId = query.get('xmlId') || undefined;
  const path = await lookupEntity('translation', slug, xmlId);

  if (!path) {
    return notFound();
  }

  redirect(path);
}

export const revalidate = 3600;
