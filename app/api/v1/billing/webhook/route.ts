import { NextRequest, NextResponse } from 'next/server';
import { 
  revokeSubscriptionAccess, 
  grantSubscriptionAccess, 
  updateUserAccountForPlan,
  addCreditsToUser 
} from '@/app/utils/billing/subscriptionManager';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature || !STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Verify webhook signature (simplified - use Stripe SDK in production)
    const event = JSON.parse(body);

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

  try {
    if (type === 'credits') {
      await addCreditsToUser(userId, parseInt(credits));
    } else if (plan === 'sync-plan' || plan === 'ai-outreach') {
      await updateUserAccountForPlan(userId, plan);
      await grantSubscriptionAccess(userId, plan);
    }
  } catch (error) {
    console.error('Failed to handle checkout completion:', error);
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  const { status, metadata } = subscription;
  const { userId, plan } = metadata;

  if (!userId) return;

  try {
    if (status === 'past_due' || status === 'unpaid') {
      await revokeSubscriptionAccess(userId, plan);
    } else if (status === 'active') {
      await grantSubscriptionAccess(userId, plan);
    }
  } catch (error) {
    console.error('Failed to handle subscription update:', error);
  }
}

async function handleSubscriptionCancelled(subscription: any) {
  const { metadata } = subscription;
  const { userId, plan } = metadata;

  if (!userId) return;

  try {
    await revokeSubscriptionAccess(userId, plan);
  } catch (error) {
    console.error('Failed to handle subscription cancellation:', error);
  }
}
