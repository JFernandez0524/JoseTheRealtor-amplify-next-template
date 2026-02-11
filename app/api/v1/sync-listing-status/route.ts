import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient({ region: 'us-east-1' });

export async function POST(request: NextRequest) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔄 Invoking syncListingStatus Lambda for user ${user.userId}`);

    // Invoke Lambda function
    const response = await lambda.send(
      new InvokeCommand({
        FunctionName: process.env.SYNC_LISTING_STATUS_FUNCTION_NAME,
        Payload: JSON.stringify({ userId: user.userId }),
      })
    );

    const result = JSON.parse(
      new TextDecoder().decode(response.Payload)
    );

    if (result.statusCode !== 200) {
      throw new Error(result.body || 'Lambda invocation failed');
    }

    const body = JSON.parse(result.body);

    return NextResponse.json({
      success: true,
      updated: body.updated,
      total: body.total,
      failed: body.failed,
    });
  } catch (error) {
    console.error('Error syncing listing status:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync listing status',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
