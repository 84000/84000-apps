import { parseToh } from '@lib-utils';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

async function sendRevisionEmail({
  toh,
  type,
  label,
  body,
}: {
  toh: string;
  type: string;
  label: string;
  body: string;
}) {
  const apiKey = process.env['RESEND_API_KEY'];
  const from = process.env['FEEDBACK_SENDER'];
  const to = process.env['FEEDBACK_RECIPIENT'];

  if (!apiKey || !from || !to) {
    throw new Error('Missing email configuration environment variables');
  }

  const resend = new Resend(apiKey);
  const trimmedLabel = label.split('\n').join(', ').trim();

  const subject = `[Revision Suggestion] ${parseToh(toh)} - ${type} ${trimmedLabel}`;

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    text: body,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function handleFeedbackPost(request: NextRequest) {
  try {
    const { toh, type, label, body } = await request.json();

    if (
      typeof toh !== 'string' ||
      !toh.trim() ||
      typeof type !== 'string' ||
      !type.trim() ||
      typeof label !== 'string' ||
      !label.trim() ||
      typeof body !== 'string' ||
      !body.trim()
    ) {
      return NextResponse.json(
        { error: 'All fields (toh, type, label, body) are required.' },
        { status: 400 },
      );
    }

    await sendRevisionEmail({ toh, type, label, body });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to send revision email:', error);
    return NextResponse.json(
      { error: 'Failed to send feedback.' },
      { status: 500 },
    );
  }
}
