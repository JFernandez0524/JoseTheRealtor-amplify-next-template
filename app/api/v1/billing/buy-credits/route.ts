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

    const { package: packageType } = await req.json(); // '100', '250', '500'

    const creditPackages = {
      '100': {
        credits: 100,
        price: 1000, // $10.00 in cents
        priceId: 'price_1SovJYR59rm8qzIq5u1WuyXp'
      },
      '250': {
        credits: 250,
        price: 2500, // $25.00 in cents
        priceId: 'price_1SovJtR59rm8qzIq92wdSF9C'
      },
      '500': {
        credits: 500,
        price: 5000, // $50.00 in cents
        priceId: 'price_1SovK7R59rm8qzIqv8xZHFTM'
      }
    };

    const selectedPackage = creditPackages[packageType as keyof typeof creditPackages];
    if (!selectedPackage) {
      return NextResponse.json({ error: 'Invalid package' }, { status: 400 });
    }

    const params: Record<string, string> = {
        'success_url': `${new URL(req.url).origin}/billing/credits-success?session_id={CHECKOUT_SESSION_ID}`,
        'cancel_url': `${new URL(req.url).origin}/pricing`,
        'payment_method_types[0]': 'card',
        'mode': 'payment',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': `${selectedPackage.credits} Skip Tracing Credits`,
        'line_items[0][price_data][product_data][description]': `${selectedPackage.credits} skip tracing credits at $0.10 each`,
        'line_items[0][price_data][unit_amount]': selectedPackage.price.toString(),
        'line_items[0][quantity]': '1',
        'metadata[userId]': user.userId,
        'metadata[credits]': selectedPackage.credits.toString(),
        'metadata[type]': 'credits',
      };
      if (userEmail) params['customer_email'] = userEmail;

    // Create Stripe checkout session for one-time payment
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
      console.error('Credits checkout error:', session.error || session);
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
    console.error('Credits checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
