import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';

const s3 = new S3Client({});

export async function logAuditEvent(lead: any, action: string) {
  if (!config.auditBucket) {
    console.warn('Audit logging disabled — no bucket configured');
    return;
  }

  const key = `leads/${new Date().toISOString()}-${lead.id || 'new'}.json`;

  await s3.send(
    new PutObjectCommand({
      Bucket: config.auditBucket,
      Key: key,
      Body: JSON.stringify({ timestamp: new Date(), action, lead }),
      ContentType: 'application/json',
    })
  );

  console.log(`🪵 Audit event logged: ${key}`);
}
