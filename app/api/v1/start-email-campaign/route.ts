import { NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';

/**
 * START BULK EMAIL CAMPAIGN
 * 
 * Triggers bulk email campaign for all eligible GHL contacts.
 * Sends initial prospecting email to contacts that haven't been emailed yet.
 * 
 * POST /api/v1/start-email-campaign
 */
export async function POST(req: Request) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[EMAIL_CAMPAIGN] Starting campaign for user:', user.userId);

    // Get function name from environment or construct it
    const functionName = process.env.BULK_EMAIL_CAMPAIGN_FUNCTION_NAME || 
      `amplify-${process.env.AMPLIFY_APP_ID}-${process.env.AMPLIFY_BRANCH}-bulkEmailCampaignlambda7`;

    console.log('[EMAIL_CAMPAIGN] Function name:', functionName);

    // Use Cognito Identity Pool credentials for Lambda invocation
    const lambda = new LambdaClient({ 
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: fromCognitoIdentityPool({
        clientConfig: { region: process.env.AWS_REGION || 'us-east-1' },
        identityPoolId: process.env.NEXT_PUBLIC_AWS_COGNITO_IDENTITY_POOL_ID!,
      })
    });

    // Invoke bulk email campaign Lambda
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({ userId: user.userId })
    });

    const response = await lambda.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.Payload));

    console.log('[EMAIL_CAMPAIGN] Lambda response:', result);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Email campaign started: ${result.successCount} emails sent`,
        totalContacts: result.totalContacts,
        successCount: result.successCount,
        failCount: result.failCount
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[EMAIL_CAMPAIGN] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
