import { NextResponse } from 'next/server';
import crypto from 'crypto';

// GHL Public Key for webhook verification
const GHL_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSC
Frm602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6
dO0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJezlYJ3DVfB
csedpinheNnyYeFXolrJvcsjDtfAeRx5ByHQmTnSdFUzuAnC9/GepgLT9SM4nCpv
uxmZMxrJt5Rw+VUaQ9B8JSvbMPpez4peKaJPZHBbU3OdeCVx5klVXXZQGNHOs8gF
3kvoV5rTnXV0IknLBXlcKKAQLZcY/Q9rG6Ifi9c+5vqlvHPCUJFT5XUGG5RKgOKU
J062fRtN+rLYZUV+BjafxQauvC8wSWeYja63VSUruvmNj8xkx2zE/Juc+yjLjTXp
IocmaiFeAO6fUtNjDeFVkhf5LNb59vECyrHD2SQIrhgXpO4Q3dVNA5rw576PwTzN
h/AMfHKIjE4xQA1SZuYJmNnmVZLIZBlQAF9Ntd03rfadZ+yDiOXCCs9FkHibELhC
HULgCsnuDJHcrGNd5/Ddm5hxGQ0ASitgHeMZ0kcIOwKDOzOU53lDza6/Y09T7sYJ
PQe7z0cvj7aE4B+Ax1ZoZGPzpJlZtGXCsu9aTEGEnKzmsFqwcSsnw3JB31IGKAyk
T1hhTiaCeIY/OwwwNUY2yvcCAwEAAQ==
-----END PUBLIC KEY-----`;

// Store processed webhook IDs
const processedWebhooks = new Set<string>();

function verifyWebhookSignature(payload: string, signature: string): boolean {
  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(payload);
    verifier.end();
    return verifier.verify(GHL_PUBLIC_KEY, signature, 'base64');
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    
    // 1. Verify webhook signature
    const signature = req.headers.get('x-wh-signature');
    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. Check for duplicates
    if (body.webhookId && processedWebhooks.has(body.webhookId)) {
      console.log('Duplicate webhook, skipping:', body.webhookId);
      return NextResponse.json({ message: 'Already processed' });
    }

    console.log('App Install webhook payload:', JSON.stringify(body, null, 2));

    const { type, appId, locationId, companyId, userId, installType } = body;

    if (type === 'INSTALL') {
      // 3. Process asynchronously
      setImmediate(() => {
        processAppInstall(body);
      });

      // 4. Mark as processed
      if (body.webhookId) {
        processedWebhooks.add(body.webhookId);
      }
    }

    // 5. Respond immediately
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('App install webhook error:', error);
    // Return 200 even for processing errors
    return NextResponse.json({ success: false, error: 'Processing failed' });
  }
}

async function processAppInstall(body: any) {
  try {
    const { 
      appId, 
      locationId, 
      companyId, 
      userId, 
      installType,
      companyName,
      isWhitelabelCompany,
      whitelabelDetails 
    } = body;

    console.log(`App installed: ${installType} - Location: ${locationId}, Company: ${companyId}`);

    // TODO: Store installation details in database
    // await storeAppInstallation({
    //   appId,
    //   locationId,
    //   companyId,
    //   userId,
    //   installType,
    //   companyName,
    //   isWhitelabelCompany,
    //   whitelabelDetails,
    //   installedAt: new Date()
    // });

    console.log('Successfully processed app install webhook:', body.webhookId);
  } catch (error) {
    console.error('Failed to process app install webhook:', body.webhookId, error);
  }
}
