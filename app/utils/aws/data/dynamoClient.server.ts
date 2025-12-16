// app/utils/aws/data/dynamoClient.server.ts (New File)

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Initialize the standard AWS SDK client.
// It automatically uses the Lambda's execution role if run in AWS.
const client = new DynamoDBClient({});

// Export the Document Client for simpler CRUD operations
export const ddbDocClient = DynamoDBDocumentClient.from(client);
