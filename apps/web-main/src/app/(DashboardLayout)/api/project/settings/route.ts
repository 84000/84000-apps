import { createServerClient, getSession } from '@data-access/ssr';
import { NextRequest, NextResponse } from 'next/server';

const REQUIRED_ROLES = ['admin'];

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { uuid, contractDate = null, contractId = '' } = body;

  if (!uuid) {
    return new NextResponse(
      JSON.stringify({ error: 'Project ID is required' }),
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

  const updates: { contract_date?: string; contract_id?: string } = {};

  const date = contractDate ? new Date(contractDate) : null;
  if (date) {
    const formattedDate = date.toISOString().split('T')[0]; // Format to YYYY-MM-DD
    updates.contract_date = formattedDate;
  }

  if (contractId) {
    updates.contract_id = contractId;
  }

  const { error } = await supabase
    .from('projects')
    .update(updates)
    .eq('uuid', uuid);

  if (error) {
    console.error('Failed to update project settings:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to update project settings' }),
      { status: 500 },
    );
  }

  return new NextResponse('{}', { status: 200 });
}
