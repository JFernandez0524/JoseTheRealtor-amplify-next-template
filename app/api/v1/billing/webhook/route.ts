import { NextResponse } from 'next/server';

// This endpoint has been replaced by the stripeWebhookHandler Lambda Function URL.
// Update your Stripe webhook URL in the dashboard to the Lambda Function URL.
export async function POST() {
  return NextResponse.json(
    { error: 'This webhook endpoint is no longer active. Update Stripe to use the Lambda Function URL.' },
    { status: 410 }
  );
}
