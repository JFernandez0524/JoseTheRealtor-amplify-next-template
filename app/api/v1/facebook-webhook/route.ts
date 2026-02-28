import { NextRequest } from 'next/server';
import crypto from 'crypto';

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const META_APP_SECRET = process.env.META_APP_SECRET;

/**
 * VERIFICATION HANDLER (GET)
 * Used by Meta to verify your webhook endpoint.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
    console.log('✅ WEBHOOK_VERIFIED');
    return new Response(challenge, { status: 200 });
  }
  
  return new Response('Verification failed', { status: 403 });
}

/**
 * EVENT NOTIFICATION HANDLER (POST)
 * Receives messages and validates their signature.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Get the raw body as text for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');

    if (!signature) {
      console.warn('⚠️ No signature found in headers.');
      return new Response('No signature', { status: 401 });
    }

    // 2. Validate Signature
    const elements = signature.split('=');
    const signatureHash = elements[1];
    const expectedHash = crypto
      .createHmac('sha256', META_APP_SECRET as string)
      .update(rawBody, 'utf8')
      .digest('hex');

    if (signatureHash !== expectedHash) {
      console.error('❌ Signature mismatch! The request may not be from Meta.');
      return new Response('Unauthorized', { status: 401 });
    }

    // 3. Parse and Process
    const body = JSON.parse(rawBody);

    if (body.object === 'page') {
      body.entry.forEach((entry: any) => {
        const webhook_event = entry.messaging?.[0];
        if (webhook_event) {
          console.log('📩 Validated Event:', webhook_event);
          const sender_psid = webhook_event.sender.id;
          console.log('Sender PSID:', sender_psid);
        }
      });

      return new Response('EVENT_RECEIVED', { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  } catch (error) {
    console.error('🔥 Webhook Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}