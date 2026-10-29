import {
  createAnonServerClient,
  lookupEntityWithClient,
} from '@eightyfourthousand/data-access/ssr';
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

  const { path } = await lookupEntityWithClient({
    client: createAnonServerClient(),
    type,
    entity,
    searchParams,
    prefix: '/translation',
  });

  if (!path) {
    return notFound();
  }

  redirect(path);
}

export const revalidate = 3600;
