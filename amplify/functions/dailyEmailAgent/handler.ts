// v2 - force redeploy with updated shared outreachQueue index names
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import axios from "axios"; // used for internal APP_URL call only
import { ghlUpdateContact } from '../shared/ghlClient';
import { isWithinBusinessHours, getNextBusinessHourMessage } from '../shared/businessHours';
import { getValidGhlToken } from '../shared/ghlTokenManager';

const dynamoClient = new DynamoDBClient({});

interface GHLIntegration {
  id: string;
  userId: string;
  locationId: string;
  accessToken: string;
  campaignEmail?: string;
  emailSignature?: string;
}

/**
 * DAILY EMAIL OUTREACH AGENT
 * 
 * Automated Lambda function that sends personalized prospecting emails to leads
 * using the AMMO framework (Audience-Message-Method-Outcome).
 * 
 * SCHEDULE:
 * - Runs every hour (configured in resource.ts via EventBridge)
 * - Only sends during business hours (Mon-Fri 9AM-7PM, Sat 9AM-12PM EST)
 * - Sunday: No emails sent
 * 
 * BATCH LIMITS (Compliance):
 * - Max 50 emails per hour per integration
 * - Prevents overwhelming recipients
 * - Stays within email provider limits
 * - If 10,000 leads ready, spreads over 200 hours (8+ days)
 * 
 * WORKFLOW:
 * 1. Check if within business hours (exit if not)
 * 2. Scan DynamoDB for active GHL integrations with campaignEmail configured
 * 3. For each integration:
 *    a. Query OutreachQueue for PENDING email contacts (limit 50)
 *    b. Send personalized email via /api/v1/send-email-to-contact
 *    c. Update queue with nextEmailDate = today + 4 days
 * 4. Rate limit: 2 seconds between emails
 * 
 * EMAIL CONTENT (AMMO Framework):
 * - Subject: "Clarity on [Property Address]" (3-6 words)
 * - Hook: Professional salutation (name only, no "Hi/Hello")
 * - Relate: Shows understanding of their probate/foreclosure situation
 * - Bridge: Presents two clear options (cash offer vs retail listing)
 * - Ask: Invites them to meet and discuss options
 * - Signature: Professional contact information
 * 
 * ENVIRONMENT VARIABLES:
 * - GHL_INTEGRATION_TABLE_NAME: DynamoDB table for GHL integrations
 * - AMPLIFY_DATA_OutreachQueue_TABLE_NAME: DynamoDB table for outreach queue
 * - APP_URL: Base URL for API calls (e.g., https://leads.josetherealtor.com)
 */

export const handler = async (event: any) => {
  console.log('🚀 Starting daily email outreach agent...');
  
  // Check if we're within business hours
  if (!isWithinBusinessHours()) {
    const message = getNextBusinessHourMessage();
    console.log(`⏰ ${message}`);
    return { statusCode: 200, body: message };
  }
  
  console.log('✅ Within business hours. Proceeding with email outreach.');
  
  try {
    // Get all active GHL integrations
    const scanCommand = new ScanCommand({
      TableName: process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME,
      FilterExpression: 'attribute_exists(accessToken) AND isActive = :active',
      ExpressionAttributeValues: {
        ':active': { BOOL: true }
      }
    });
    
    const result = await dynamoClient.send(scanCommand);
    
    if (!result.Items || result.Items.length === 0) {
      console.log('No active GHL integrations found');
      return { statusCode: 200, body: 'No integrations to process' };
    }

    const integrations: GHLIntegration[] = result.Items.map(item => ({
      id: item.id.S!,
      userId: item.userId.S!,
      locationId: item.locationId.S!,
      accessToken: item.accessToken.S!,
      campaignEmail: item.campaignEmail?.S || undefined,
      emailSignature: item.emailSignature?.S || undefined,
    }));

    console.log(`Found ${integrations.length} active integrations`);

    let totalEmailsSent = 0;

    // Process each integration
    for (const integration of integrations) {
      if (!integration.campaignEmail) {
        console.log(`Skipping integration ${integration.id} - no campaign email configured`);
        continue;
      }

      console.log(`\n📧 Processing integration ${integration.id} for location ${integration.locationId}`);
      
      // Get valid token (auto-refreshes if expired)
      const tokenData = await getValidGhlToken(integration.userId);
      if (!tokenData) {
        console.error(`❌ Failed to get valid token for user ${integration.userId}`);
        continue;
      }
      
      const validAccessToken = tokenData.token;
      const fieldIds: Record<string, string> = tokenData.customFieldIds || {};
      
      try {
        // Query OutreachQueue for PENDING email contacts (limit 50)
        const { getPendingEmailContacts } = await import('../shared/outreachQueue');
        const eligibleContacts = await getPendingEmailContacts(integration.userId, 50);
        
        console.log(`📋 [QUEUE] Found ${eligibleContacts.length} pending email contacts`);

        if (eligibleContacts.length === 0) {
          console.log('No contacts ready for email outreach');
          continue;
        }

        // Map queue items to contact format using dynamic field IDs
        const contacts = eligibleContacts.map((q: any) => ({
          id: q.contactId,
          firstName: q.contactName?.split(' ')[0],
          lastName: q.contactName?.split(' ').slice(1).join(' '),
          email: q.contactEmail,
          customFields: [
            fieldIds.property_address && { id: fieldIds.property_address, value: q.propertyAddress },
            fieldIds.property_city && { id: fieldIds.property_city, value: q.propertyCity },
            fieldIds.property_state && { id: fieldIds.property_state, value: q.propertyState },
            fieldIds.lead_type && { id: fieldIds.lead_type, value: q.leadType },
          ].filter((f): f is { id: string; value: any } => Boolean(f)),
          _queueId: q.id,
          _queueAttempts: q.emailAttempts || 0
        }));

        console.log(`${contacts.length} contacts eligible for email outreach`);

        // Send email to each eligible contact
        for (const contact of contacts) {
          try {
            console.log(`Sending email to contact ${contact.id} (${contact.email})`);

            // Pre-lock: set nextEmailDate = +4 days BEFORE sending so the contact is
            // protected even if the post-send updateEmailSent call fails.
            try {
              const { preLockEmailSend } = await import('../shared/outreachQueue');
              await preLockEmailSend(contact._queueId);
            } catch (lockError: any) {
              console.error(`❌ [QUEUE] Failed to pre-lock ${contact._queueId}, skipping:`, lockError.message);
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }

            const response = await axios.post(
              `${process.env.APP_URL}/api/v1/send-email-to-contact`,
              {
                contactId: contact.id,
                accessToken: validAccessToken,
                fromEmail: integration.campaignEmail,
                emailSignature: integration.emailSignature,
                toEmail: contact.email,
                touchNumber: contact._queueAttempts + 1, // 1=initial, 2-7=follow-ups
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
                }
              }
            );

            if (response.data.success) {
              console.log(`✅ Email sent successfully to ${contact.email}`);
              totalEmailsSent++;

              // Update queue status (increments attempts, sets lastEmailSent, keeps +4-day nextEmailDate)
              console.log(`📋 [QUEUE] Updating queue item ${contact._queueId}`);
              try {
                const { updateEmailSent } = await import('../shared/outreachQueue');
                await updateEmailSent(contact._queueId);
                console.log(`✅ [QUEUE] Updated queue item ${contact._queueId}`);
              } catch (queueError: any) {
                console.error(`❌ [QUEUE] Failed to update queue status (pre-lock still protects cadence):`, queueError.message);
              }

              // Update email counter in GHL (increment, not set to 1)
              const emailCounterId = fieldIds.email_attempt_counter;
              const lastEmailDateId = fieldIds.last_email_date;
              if (emailCounterId || lastEmailDateId) {
                try {
                  const currentCounter = parseInt(contact.customFields?.find((f: any) => emailCounterId && f.id === emailCounterId)?.value || '0');
                  console.log(`📊 [GHL] Updating counter for ${contact.id}: ${currentCounter} → ${currentCounter + 1}`);
                  const updateFields = [
                    emailCounterId && { id: emailCounterId, value: (currentCounter + 1).toString() },
                    lastEmailDateId && { id: lastEmailDateId, value: new Date().toISOString() },
                  ].filter(Boolean);
                  await ghlUpdateContact(validAccessToken, contact.id, { customFields: updateFields });
                  console.log(`✅ [GHL] Counter updated for ${contact.id}`);
                } catch (ghlError: any) {
                  console.error(`❌ [GHL] Failed to update counter for ${contact.id}:`, ghlError.response?.data || ghlError.message);
                }
              }
            } else {
              console.error(`Failed to send email to ${contact.email}:`, response.data.error);

              const errorMsg = response.data.error || '';
              const isPermanentFailure = errorMsg.includes('DND is active') || errorMsg.includes('Contact has no email');
              if (isPermanentFailure) {
                // Mark permanently so it never retries
                try {
                  const { updateEmailStatus } = await import('../shared/outreachQueue');
                  await updateEmailStatus(contact._queueId, 'FAILED');
                  console.log(`📋 [QUEUE] Marked ${contact._queueId} as FAILED (${errorMsg})`);
                } catch (queueError: any) {
                  console.error(`❌ [QUEUE] Failed to update status:`, queueError.message);
                }
              } else {
                // Transient failure: release the pre-lock so we retry tomorrow
                try {
                  const { releaseEmailLock } = await import('../shared/outreachQueue');
                  await releaseEmailLock(contact._queueId);
                } catch (unlockError: any) {
                  console.error(`❌ [QUEUE] Failed to release lock for ${contact._queueId}:`, unlockError.message);
                }
              }
            }

            // Rate limiting: 2 seconds between emails
            await new Promise(resolve => setTimeout(resolve, 2000));

          } catch (error: any) {
            console.error(`Failed to send email to contact ${contact.id}:`, error.response?.data || error.message);
          }
        }

      } catch (error: any) {
        console.error(`Error processing integration ${integration.id}:`, error.response?.data || error.message);
      }
    }

    console.log(`\n✅ Daily email outreach complete. Total emails sent: ${totalEmailsSent}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        emailsSent: totalEmailsSent
      })
    };

  } catch (error: any) {
    console.error('❌ Daily email outreach failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
