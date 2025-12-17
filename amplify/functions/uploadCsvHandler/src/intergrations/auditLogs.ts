import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';

const s3 = new S3Client({});

/**
 * Logs events to the Audit Bucket.
 * @param action The name of the event (e.g., 'CSV_IMPORT_SUCCESS')
 * @param context The data associated with the event (Lead object or metadata)
 */
export async function logAuditEvent(action: string, context: any) {
  if (!config.auditBucket) {
    console.warn('Audit logging disabled — no bucket configured');
    return;
  }

  // Use a context ID if available, otherwise 'system'
  const entityId = context?.id || context?.ownerId || 'system';
  const key = `logs/${action}/${new Date().toISOString()}-${entityId}.json`;

  await s3.send(
    new PutObjectCommand({
      Bucket: config.auditBucket,
      Key: key,
      Body: JSON.stringify({
        timestamp: new Date().toISOString(),
        action,
        data: context,
      }),
      ContentType: 'application/json',
    })
  );

  console.log(`Log successfully written to: ${key}`);
}
