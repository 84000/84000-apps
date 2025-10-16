import { lookupEntity } from '@data-access/ssr';
import { notFound, redirect } from 'next/navigation';

export async function GET(
  _request: Request,
  { params }: { params: { type: string; slug: string } },
) {
  const { type, slug } = await Promise.resolve(params);
  const path = await lookupEntity(type, slug);

  if (!path) {
    return notFound();
  }

  redirect(path);
}

export const revalidate = 3600;
