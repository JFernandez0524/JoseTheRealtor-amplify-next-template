import { NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';

/**
 * FIX FAILED GHL SYNCS
 * 
 * Retries all leads marked as "sync failed" in DynamoDB.
 * Searches GHL for existing contacts or creates new ones.
 * 
 * POST /api/v1/fix-failed-syncs
 */
export async function POST(req: Request) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const groups = user.signInDetails?.loginId ? [] : (user as any).groups || [];
    if (!groups.includes('ADMINS')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[FIX_SYNCS] Starting sync repair...');

    const functionName = process.env.FIX_FAILED_SYNCS_FUNCTION_NAME || 
      `amplify-${process.env.AMPLIFY_APP_ID}-${process.env.AMPLIFY_BRANCH}-fixFailedSyncslambda`;

    const lambda = new LambdaClient({ 
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: fromCognitoIdentityPool({
        clientConfig: { region: process.env.AWS_REGION || 'us-east-1' },
        identityPoolId: process.env.NEXT_PUBLIC_AWS_COGNITO_IDENTITY_POOL_ID!,
      })
    });

    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'RequestResponse',
    });

    const response = await lambda.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.Payload));

    console.log('[FIX_SYNCS] Lambda response:', result);

    if (result.statusCode === 200) {
      const body = JSON.parse(result.body);
      return NextResponse.json({
        success: true,
        fixed: body.fixed || 0,
        created: body.created || 0,
        failed: body.failed || 0,
        total: body.total || 0
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.body || 'Failed to fix syncs'
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[FIX_SYNCS] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
