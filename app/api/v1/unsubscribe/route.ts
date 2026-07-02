import { NextResponse } from 'next/server';

/**
 * POST /api/v1/unsubscribe
 *
 * Thin proxy to the `unsubscribeHandler` Lambda Function URL.
 *
 * WHY A PROXY: honoring an unsubscribe click requires reading/writing across tenants
 * (GhlIntegration/OutreachQueue/PropertyLead are owner-scoped in AppSync) and the Next.js SSR
 * runtime has neither the DynamoDB table names nor IAM to do it — only Lambdas do. The Lambda
 * resolves the owning tenant from the contact and applies the opt-out in the correct account.
 *
 * REQUEST:  { contactId: string, email?: string }
 * RESPONSE: { success: boolean, message?: string, error?: string }  (passed through from the Lambda)
 *
 * AUTH: none — public, CAN-SPAM compliant (instant opt-out, no login). Called by app/unsubscribe/page.tsx.
 *
 * CONFIG: UNSUBSCRIBE_FUNCTION_URL must be present in the SSR runtime (see amplify.yml env allow-list).
 */
export async function POST(req: Request) {
  try {
    const { contactId, email } = await req.json();

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'Contact ID is required' },
        { status: 400 },
      );
    }

    const functionUrl = process.env.UNSUBSCRIBE_FUNCTION_URL;
    if (!functionUrl) {
      console.error('❌ [UNSUBSCRIBE] UNSUBSCRIBE_FUNCTION_URL is not configured');
      return NextResponse.json(
        { success: false, error: 'Unsubscribe service is not configured' },
        { status: 500 },
      );
    }

    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId, email }),
    });

    const data = await res.json().catch(() => ({
      success: false,
      error: 'Unsubscribe service returned an invalid response',
    }));

    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('❌ [UNSUBSCRIBE] Proxy error:', error?.message || error);
    return NextResponse.json(
      { success: false, error: 'Failed to process unsubscribe request' },
      { status: 500 },
    );
  }
}
