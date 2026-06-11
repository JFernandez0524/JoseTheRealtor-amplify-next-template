import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  revokeSubscriptionAccess,
  grantSubscriptionAccess,
  updateUserAccountForPlan,
  addCreditsToUser
} from '@/app/utils/billing/subscriptionManager';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Replicate Stripe's webhook signature verification without the SDK.
// Spec: https://docs.stripe.com/webhooks/signatures
function verifyStripeSignature(payload: string, header: string, secret: string): any {
  // Header format: t=<unix_ts>,v1=<hex_hmac>[,v0=<old_hmac>]
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
  const timestamp = parts['t'];
  const v1 = parts['v1'];

  if (!timestamp || !v1) throw new Error('Malformed stripe-signature header');

  // Reject timestamps older than 5 minutes to prevent replay attacks
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) {
    throw new Error('Stripe webhook timestamp outside tolerance window');
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  // Constant-time comparison prevents timing attacks
  if (
    v1.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected))
  ) {
    throw new Error('Stripe webhook signature mismatch');
  }

  return JSON.parse(payload);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing webhook signature or secret' }, { status: 400 });
  }

  let event: any;
  try {
    event = verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Stripe signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object);
        break;
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: any) {
  const { metadata } = session;
  const { userId, plan, credits, type } = metadata;

  if (type === 'credits') {
    await addCreditsToUser(userId, parseInt(credits));
  } else if (plan === 'sync-plan' || plan === 'ai-outreach') {
    await updateUserAccountForPlan(userId, plan);
    await grantSubscriptionAccess(userId, plan);
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  const { status, metadata } = subscription;
  const { userId, plan } = metadata;

  if (!userId) return;

  if (status === 'past_due' || status === 'unpaid') {
    await revokeSubscriptionAccess(userId, plan);
  } else if (status === 'active') {
    await grantSubscriptionAccess(userId, plan);
  }
}

async function handleSubscriptionCancelled(subscription: any) {
  const { metadata } = subscription;
  const { userId, plan } = metadata;

  if (!userId) return;

  await revokeSubscriptionAccess(userId, plan);
}
