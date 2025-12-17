// amplify/functions/uploadCsvHandler/src/intergrations/notifications.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const NOTIFICATION_TABLE = process.env.AMPLIFY_DATA_NOTIFICATION_TABLE_NAME;

export async function sendNotification(
  userId: string,
  title: string,
  message: string
) {
  if (!NOTIFICATION_TABLE) {
    console.error(
      '❌ Notification Error: Table name missing in environment variables.'
    );
    return;
  }

  try {
    await ddbDocClient.send(
      new PutCommand({
        TableName: NOTIFICATION_TABLE,
        Item: {
          id: randomUUID(),
          owner: userId, // Ensure this matches the Cognito sub
          title: title,
          message: message,
          type:
            title.includes('Error') || title.includes('Action')
              ? 'ERROR'
              : 'SUCCESS',
          isRead: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          __typename: 'Notification',
        },
      })
    );
    console.log(`✅ In-app notification created for ${userId}`);
  } catch (err: any) {
    console.error('❌ Failed to save notification to DynamoDB:', err.message);
  }
}
