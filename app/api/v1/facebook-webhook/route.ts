import { NextRequest, NextResponse } from 'next/server';

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

/**
 * VERIFICATION HANDLER (GET)
 * Meta calls this when you click "Verify" in the App Dashboard.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Check if a token and mode is in the query string of the request
  if (mode && token) {
    // Check the mode and token sent is correct
    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
      console.log('✅ WEBHOOK_VERIFIED');
      // IMPORTANT: Return the challenge as a plain string (text/plain)
      return new Response(challenge, { status: 200 });
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
      return new Response('Verification failed', { status: 403 });
    }
  }

  return new Response('Hello Webhook', { status: 200 });
}

/**
 * EVENT NOTIFICATION HANDLER (POST)
 * Meta calls this whenever a user sends a message.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if this is an event from a page subscription
    if (body.object === 'page') {
      
      // Iterate over each entry - there may be multiple if batched
      body.entry.forEach((entry: any) => {
        // Gets the message. entry.messaging is an array
        const webhook_event = entry.messaging[0];
        console.log('📩 Received Event:', webhook_event);

        const sender_psid = webhook_event.sender.id;
        console.log('Sender PSID:', sender_psid);
      });

      // Returns a '200 OK' response to all requests
      return new Response('EVENT_RECEIVED', { status: 200 });
    } else {
      // Return a '404 Not Found' if event is not from a page subscription
      return new Response('Not Found', { status: 404 });
    }
  } catch (error) {
    console.error('Error parsing webhook:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}