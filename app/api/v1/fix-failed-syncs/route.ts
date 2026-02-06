import { NextRequest, NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient({ region: 'us-east-1' });

export async function POST(request: NextRequest) {
  try {
    // Get function name from environment
    const functionName = process.env.FIX_FAILED_SYNCS_FUNCTION_NAME;
    
    if (!functionName) {
      return NextResponse.json(
        { error: 'Lambda function not configured' },
        { status: 500 }
      );
    }

    // Invoke Lambda
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'RequestResponse',
    });

    const response = await lambda.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.Payload));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to invoke fix-syncs Lambda:', error);
    return NextResponse.json(
      { error: 'Failed to fix syncs' },
      { status: 500 }
    );
  }
}
