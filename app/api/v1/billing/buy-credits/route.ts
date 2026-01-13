import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

export async function POST(req: NextRequest) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user email from attributes
    const userEmail = user.signInDetails?.loginId || user.username || 'user@example.com';

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

    // Create Stripe checkout session for one-time payment
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'success_url': `${process.env.NEXT_PUBLIC_APP_URL}/billing/credits-success?session_id={CHECKOUT_SESSION_ID}`,
        'cancel_url': `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
        'payment_method_types[0]': 'card',
        'mode': 'payment', // One-time payment, not subscription
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': `${selectedPackage.credits} Skip Tracing Credits`,
        'line_items[0][price_data][product_data][description]': `${selectedPackage.credits} skip tracing credits at $0.10 each`,
        'line_items[0][price_data][unit_amount]': selectedPackage.price.toString(),
        'line_items[0][quantity]': '1',
        'customer_email': userEmail,
        'metadata[userId]': user.userId,
        'metadata[credits]': selectedPackage.credits.toString(),
        'metadata[type]': 'credits',
      }),
    });

    const session = await response.json();

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
