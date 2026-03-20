import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

export async function GET(request: NextRequest) {
  try {
    const contactId = request.nextUrl.searchParams.get('contactId');
    
    if (!contactId) {
      return NextResponse.json({ error: 'contactId required' }, { status: 400 });
    }

    // Query OutreachQueue by contactId (primary key is userId+contactId+channel)
    const result = await docClient.send(new QueryCommand({
      TableName: process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME,
      IndexName: 'byLeadId',
      KeyConditionExpression: 'contactId = :contactId',
      ExpressionAttributeValues: {
        ':contactId': contactId
      }
    }));

    return NextResponse.json({
      contactId,
      found: result.Items && result.Items.length > 0,
      entries: result.Items || [],
      count: result.Items?.length || 0
    });
  } catch (error: any) {
    console.error('Debug error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
