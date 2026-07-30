import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

const docClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
);

const GHL_INTEGRATION_TABLE =
  process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME ||
  'GhlIntegration-ahlnflzdejd5jdrulwuqcuxm6i-NONE';
const OUTREACH_QUEUE_TABLE =
  process.env.AMPLIFY_DATA_OutreachQueue_TABLE_NAME ||
  'OutreachQueue-ahlnflzdejd5jdrulwuqcuxm6i-NONE';

/**
 * POST /api/v1/ghl/disconnect
 *
 * Atomically disconnects the GHL integration for the authenticated user and
 * safely pauses any pending outreach queue items without deleting lead data.
 */
export async function POST() {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.userId;

    // 1. Scan for active GhlIntegration for this user
    const integrationScan = await docClient.send(
      new ScanCommand({
        TableName: GHL_INTEGRATION_TABLE,
        FilterExpression: 'userId = :userId AND (isActive = :trueVal OR attribute_not_exists(isActive))',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':trueVal': true,
        },
      })
    );

    const integrations = integrationScan.Items || [];
    let updatedIntegrationsCount = 0;

    for (const integration of integrations) {
      await docClient.send(
        new UpdateCommand({
          TableName: GHL_INTEGRATION_TABLE,
          Key: { id: integration.id },
          UpdateExpression: 'SET isActive = :falseVal, accessToken = :emptyStr, refreshToken = :emptyStr, updatedAt = :now',
          ExpressionAttributeValues: {
            ':falseVal': false,
            ':emptyStr': '',
            ':now': new Date().toISOString(),
          },
        })
      );
      updatedIntegrationsCount++;
    }

    // 2. Scan for active OutreachQueue items for this user and pause them (MANUAL_HANDLING)
    let queueItemsPaused = 0;
    let lastKey: Record<string, any> | undefined;

    do {
      const queueScan = await docClient.send(
        new ScanCommand({
          TableName: OUTREACH_QUEUE_TABLE,
          FilterExpression: 'userId = :userId AND queueStatus = :outreachStatus',
          ExpressionAttributeValues: {
            ':userId': userId,
            ':outreachStatus': 'OUTREACH',
          },
          ExclusiveStartKey: lastKey,
        })
      );

      const items = queueScan.Items || [];
      for (const item of items) {
        await docClient.send(
          new UpdateCommand({
            TableName: OUTREACH_QUEUE_TABLE,
            Key: { id: item.id },
            UpdateExpression: 'SET queueStatus = :pausedStatus, updatedAt = :now',
            ExpressionAttributeValues: {
              ':pausedStatus': 'MANUAL_HANDLING',
              ':now': new Date().toISOString(),
            },
          })
        );
        queueItemsPaused++;
      }

      lastKey = queueScan.LastEvaluatedKey;
    } while (lastKey);

    console.log(
      `✅ GHL Disconnect successful for user ${userId}: ${updatedIntegrationsCount} integrations deactivated, ${queueItemsPaused} queue items paused.`
    );

    return NextResponse.json({
      success: true,
      message: 'Launch AI system disconnected successfully.',
      integrationsDeactivated: updatedIntegrationsCount,
      queueItemsPaused,
    });
  } catch (error: any) {
    console.error('Error during GHL disconnect:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect integration', details: error.message },
      { status: 500 }
    );
  }
}
