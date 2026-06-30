/**
 * EMAIL STATS / BOUNCE-RATE CIRCUIT BREAKER
 *
 * Per-integration (per-sending-account) rolling daily counters of emails sent vs
 * bounced. `dailyEmailAgent` pauses an account when its bounce rate is too high,
 * so a spike self-limits instead of cascading into a GHL email suspension.
 *
 * - Counters live on GhlIntegration (emailsSentToday / emailsBouncedToday) and
 *   reset on a 24h window (mirrors the dailyMessageCount / lastDayReset pattern).
 * - bounced is incremented by ghlWebhookHandler's bounce handler.
 * - sent is incremented by dailyEmailAgent after each successful send.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
const GHL_INTEGRATION_TABLE = process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME;

export const BOUNCE_RATE_THRESHOLD = 0.05; // pause an account above 5% bounce rate
export const BOUNCE_MIN_SAMPLE = 20; // ...only once it has a meaningful sample

interface EmailStatsRecord {
  id: string;
  emailsSentToday?: number;
  emailsBouncedToday?: number;
  lastEmailStatsReset?: string | null;
}

/**
 * Pure: should sending be paused given the current window's counts?
 * Returns false until `minSample` sends have happened (avoids tripping on noise).
 */
export function bounceRateExceeded(
  sent: number,
  bounced: number,
  minSample: number = BOUNCE_MIN_SAMPLE,
  threshold: number = BOUNCE_RATE_THRESHOLD
): boolean {
  if (sent < minSample) return false;
  return bounced / sent >= threshold;
}

/**
 * Reset the daily window if it's older than 24h; returns the current counts to
 * evaluate. Pass the already-loaded integration record (no extra read).
 */
export async function resetEmailStatsIfStale(integration: EmailStatsRecord): Promise<{ sent: number; bounced: number }> {
  const last = integration.lastEmailStatsReset ? new Date(integration.lastEmailStatsReset).getTime() : 0;
  const hoursSince = (Date.now() - last) / (1000 * 60 * 60);
  if (hoursSince >= 24) {
    await docClient.send(new UpdateCommand({
      TableName: GHL_INTEGRATION_TABLE,
      Key: { id: integration.id },
      UpdateExpression: 'SET emailsSentToday = :z, emailsBouncedToday = :z, lastEmailStatsReset = :now',
      ExpressionAttributeValues: { ':z': 0, ':now': new Date().toISOString() },
    }));
    return { sent: 0, bounced: 0 };
  }
  return { sent: integration.emailsSentToday || 0, bounced: integration.emailsBouncedToday || 0 };
}

export async function incrementEmailSent(integrationId: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: GHL_INTEGRATION_TABLE,
    Key: { id: integrationId },
    UpdateExpression: 'ADD emailsSentToday :one',
    ExpressionAttributeValues: { ':one': 1 },
  }));
}

export async function incrementEmailBounced(integrationId: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: GHL_INTEGRATION_TABLE,
    Key: { id: integrationId },
    UpdateExpression: 'ADD emailsBouncedToday :one',
    ExpressionAttributeValues: { ':one': 1 },
  }));
}
