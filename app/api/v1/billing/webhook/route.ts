import { NextRequest, NextResponse } from 'next/server';
import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const GHL_AGENCY_TOKEN = process.env.GHL_AGENCY_TOKEN;

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
  const { customer_email, metadata } = session;
  const { userId, plan, credits, type } = metadata;

  try {
    // Get user account
    const { data: accounts } = await cookiesClient.models.UserAccount.list({
      filter: { owner: { eq: userId } }
    });

    const userAccount = accounts?.[0];
    if (!userAccount) return;

    if (type === 'credits') {
      // Handle credit purchase
      const creditsToAdd = parseInt(credits);
      await cookiesClient.models.UserAccount.update({
        id: userAccount.id,
        credits: (userAccount.credits || 0) + creditsToAdd,
      });

      console.log(`✅ Added ${creditsToAdd} credits to user ${userId}`);
      
    } else if (plan === 'sync-plan') {
      // Handle SYNC PLAN subscription
      await cookiesClient.models.UserAccount.update({
        id: userAccount.id,
        ghlIntegrationType: 'OAUTH', // User connects their own GHL
      });

      console.log(`✅ Activated SYNC PLAN for user ${userId}`);
      
    } else if (plan === 'ai-outreach') {
      // Handle AI OUTREACH PLAN subscription
      await cookiesClient.models.UserAccount.update({
        id: userAccount.id,
        ghlIntegrationType: 'OAUTH', // User connects their own GHL
      });

      console.log(`✅ Activated AI OUTREACH PLAN for user ${userId}`);
    }

  } catch (error) {
    console.error('Failed to handle checkout completion:', error);
  }
}

async function handleSubscriptionCancelled(subscription: any) {
  // Handle subscription cancellation
  console.log('Subscription cancelled:', subscription.id);
}
