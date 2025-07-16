import { createServerClient, getSession } from '@data-access/ssr';
import { NextRequest, NextResponse } from 'next/server';

const REQUIRED_ROLES = ['admin'];

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { uuid, notes } = body;

  if (!uuid || !notes) {
    return new NextResponse(
      JSON.stringify({ error: 'Project ID and notes are required' }),
      { status: 400 },
    );
  }

  const supabase = await createServerClient();
  const session = await getSession({ client: supabase });
  if (!session) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }
  const { claims } = session;
  const { role } = claims;

  // preliminary check for role, but the database is the ultimate authority
  if (!REQUIRED_ROLES.includes(role)) {
    return new NextResponse(
      JSON.stringify({ error: 'Insufficient permission' }),
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from('projects')
    .update({ notes })
    .eq('uuid', uuid);

  if (error) {
    console.error('Failed to update project notes:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to update project notes' }),
      { status: 500 },
    );
  }

  return new NextResponse('{}', { status: 200 });
}
