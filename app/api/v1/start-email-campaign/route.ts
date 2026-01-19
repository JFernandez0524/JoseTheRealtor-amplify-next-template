import { NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });

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

    // Invoke bulk email campaign Lambda
    const command = new InvokeCommand({
      FunctionName: process.env.BULK_EMAIL_CAMPAIGN_FUNCTION_NAME || 'bulkEmailCampaign',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({ userId: user.userId })
    });

    const response = await lambda.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.Payload));

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
    console.error('Start email campaign error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
