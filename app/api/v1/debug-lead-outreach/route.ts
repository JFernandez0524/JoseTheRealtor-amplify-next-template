import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

export async function GET(request: NextRequest) {
  try {
    const leadId = request.nextUrl.searchParams.get('leadId');
    
    if (!leadId) {
      return NextResponse.json({ error: 'leadId required' }, { status: 400 });
    }

    // Check OutreachQueue for this lead
    const queueResult = await docClient.send(new QueryCommand({
      TableName: process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME,
      IndexName: 'byLeadId',
      KeyConditionExpression: 'leadId = :leadId',
      ExpressionAttributeValues: {
        ':leadId': leadId
      }
    }));

    // Check Lead table
    const leadResult = await docClient.send(new GetCommand({
      TableName: process.env.AMPLIFY_DATA_Lead_TABLE_NAME,
      Key: { id: leadId }
    }));

    return NextResponse.json({
      leadId,
      lead: leadResult.Item || null,
      outreachQueue: queueResult.Items || [],
      queueCount: queueResult.Items?.length || 0
    });
  } catch (error: any) {
    console.error('Debug error:', error);
    return NextResponse.json({ 
      error: error.message,
      details: error
    }, { status: 500 });
  }
}
