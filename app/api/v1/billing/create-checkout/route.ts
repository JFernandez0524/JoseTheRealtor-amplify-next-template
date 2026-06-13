import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer, AuthGetUserEmailServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

export async function POST(req: NextRequest) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get email from ID token payload (reliable for Google OAuth users)
    const userEmail = await AuthGetUserEmailServer();

    const { plan } = await req.json(); // 'sync-plan' or 'ai-outreach'

    const priceIds = {
      'sync-plan': 'price_1ThtFqR59rm8qzIqX9xHfVbn', // $39/month (BETA - SYNC PLAN)
      'ai-outreach': 'price_1SovIxR59rm8qzIqJZ6jruwi', // $250/month
    };

    const priceId = priceIds[plan as keyof typeof priceIds];
    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host;
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${proto}://${host}`;

    const params: Record<string, string> = {
        'success_url': `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        'cancel_url': `${baseUrl}/pricing`,
        'payment_method_types[0]': 'card',
        'mode': 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        // Session metadata — used by checkout.session.completed webhook
        'metadata[userId]': user.userId,
        'metadata[plan]': plan,
        // Subscription metadata — used by subscription.updated/deleted webhooks
        'subscription_data[metadata][userId]': user.userId,
        'subscription_data[metadata][plan]': plan,
      };
      if (userEmail) params['customer_email'] = userEmail;

    // Create Stripe checkout session
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    });

    const session = await response.json();

    if (!response.ok || !session.url) {
      console.error('Stripe session error:', session.error || session);
      return NextResponse.json(
        { error: session.error?.message || 'Failed to create checkout session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      checkoutUrl: session.url,
      sessionId: session.id 
    });

  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
