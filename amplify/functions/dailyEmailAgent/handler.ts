// v2 - force redeploy with updated shared outreachQueue index names
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import axios from "axios"; // used for internal APP_URL call only
import { validateEnv } from '../shared/config';
import { ghlUpdateContact } from '../shared/ghlClient';
import { isWithinBusinessHours, getNextBusinessHourMessage } from '../shared/businessHours';
import { getValidGhlToken } from '../shared/ghlTokenManager';
import { resetEmailStatsIfStale, bounceRateExceeded, incrementEmailSent } from '../shared/emailStats';
import {
  getPendingEmailContacts,
  updateEmailStatus,
  preLockEmailSend,
  updateEmailSent,
  releaseEmailLock
} from '../shared/outreachQueue';
import { isValidEmailSyntax } from '../shared/emailValidator';

validateEnv('dailyEmailAgent');

const dynamoClient = new DynamoDBClient({});

interface GHLIntegration {
  id: string;
  userId: string;
  locationId: string;
  accessToken: string;
  campaignEmail?: string;
  emailSignature?: string;
  timezone?: string;
}

/**
 * Process email outreach for a single tenant integration.
 * Respects bounce-rate circuit breakers, dynamic field IDs, and 2-second rate limits.
 */
async function processTenantIntegration(integration: GHLIntegration): Promise<{ success: boolean; emailsSent: number; reason?: string }> {
  if (!integration.campaignEmail) {
    console.log(`Skipping integration ${integration.id} (${integration.userId}) - no campaign email configured`);
    return { success: true, emailsSent: 0, reason: 'no_campaign_email' };
  }

  // Tenant-specific business hours check
  const tenantZone = integration.timezone || 'America/New_York';
  if (!isWithinBusinessHours(tenantZone)) {
    const msg = getNextBusinessHourMessage(tenantZone);
    console.log(`⏰ [TENANT ${integration.userId}] Outside business hours for ${tenantZone}: ${msg}`);
    return { success: true, emailsSent: 0, reason: 'outside_business_hours' };
  }

  console.log(`\n📧 Processing integration ${integration.id} for user ${integration.userId} in zone ${tenantZone}`);

  // ⛔ Bounce-rate circuit breaker: pause this account if its recent bounce rate is too high,
  // so a problem self-limits instead of cascading into another GHL email suspension.
  const { sent: sentToday, bounced: bouncedToday } = await resetEmailStatsIfStale(integration);
  if (bounceRateExceeded(sentToday, bouncedToday)) {
    const pct = ((bouncedToday / sentToday) * 100).toFixed(1);
    console.warn(`⛔ [EMAIL] Paused ${integration.userId} — bounce rate ${pct}% (${bouncedToday}/${sentToday}) exceeds threshold; skipping this run`);
    return { success: false, emailsSent: 0, reason: 'bounce_rate_exceeded' };
  }

  // Get valid token (auto-refreshes if expired)
  const tokenData = await getValidGhlToken(integration.userId);
  if (!tokenData) {
    console.error(`❌ Failed to get valid token for user ${integration.userId}`);
    return { success: false, emailsSent: 0, reason: 'invalid_token' };
  }

  const validAccessToken = tokenData.token;
  const fieldIds: Record<string, string> = tokenData.customFieldIds || {};
  let emailsSent = 0;

  try {
    // Query OutreachQueue for PENDING email contacts (limit 50)
    const eligibleContacts = await getPendingEmailContacts(integration.userId, 50);
    
    console.log(`📋 [QUEUE] Found ${eligibleContacts.length} pending email contacts for user ${integration.userId}`);

    if (eligibleContacts.length === 0) {
      console.log('No contacts ready for email outreach');
      return { success: true, emailsSent: 0, reason: 'no_pending_contacts' };
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

    console.log(`${contacts.length} contacts eligible for email outreach for user ${integration.userId}`);

    // Send email to each eligible contact
    for (const contact of contacts) {
      try {
        // Cheap, free last-line guard: never send to a malformed address (deliverability
        // was already vetted via Debounce at ingest). Mark FAILED so it isn't retried.
        if (!isValidEmailSyntax(contact.email)) {
          console.warn(`⚠️ [EMAIL] Skipping ${contact.id} — invalid email syntax: ${contact.email}`);
          await updateEmailStatus(contact._queueId, 'FAILED');
          continue;
        }

        console.log(`Sending email to contact ${contact.id} (${contact.email})`);

        // Pre-lock: set nextEmailDate = +4 days BEFORE sending so the contact is
        // protected even if the post-send updateEmailSent call fails.
        try {
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
            callOutcomeFieldId: fieldIds.call_outcome, // enables the send route's terminal-disposition guard
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
          emailsSent++;

          // Circuit-breaker accounting: count this send for the bounce-rate window.
          await incrementEmailSent(integration.id).catch((e: any) =>
            console.error(`⚠️ [EMAIL] Failed to increment sent counter:`, e.message)
          );

          // Update queue status (increments attempts, sets lastEmailSent, keeps +4-day nextEmailDate)
          console.log(`📋 [QUEUE] Updating queue item ${contact._queueId}`);
          try {
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
          // Terminal Call Outcome (Listed With Realtor, DNC, etc.): opt the contact out so
          // the cadence stops permanently — even if the GHL field-sync workflow didn't.
          const isTerminalOutcome = errorMsg.includes('terminal Call Outcome');
          const isPermanentFailure = errorMsg.includes('DND is active') || errorMsg.includes('Contact has no email');
          if (isTerminalOutcome) {
            try {
              await updateEmailStatus(contact._queueId, 'OPTED_OUT');
              console.log(`🛑 [QUEUE] Opted out ${contact._queueId} (${errorMsg})`);
            } catch (queueError: any) {
              console.error(`❌ [QUEUE] Failed to opt out:`, queueError.message);
            }
          } else if (isPermanentFailure) {
            // Mark permanently so it never retries
            try {
              await updateEmailStatus(contact._queueId, 'FAILED');
              console.log(`📋 [QUEUE] Marked ${contact._queueId} as FAILED (${errorMsg})`);
            } catch (queueError: any) {
              console.error(`❌ [QUEUE] Failed to update status:`, queueError.message);
            }
          } else {
            // Transient failure: release the pre-lock so we retry tomorrow
            try {
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

    return { success: true, emailsSent };

  } catch (error: any) {
    console.error(`Error processing integration ${integration.id} for user ${integration.userId}:`, error.response?.data || error.message);
    return { success: false, emailsSent, reason: error.message };
  }
}

/**
 * Main Lambda Handler
 *
 * Supports two execution modes:
 * 1. Single-Tenant Mode: `event.userId` provided -> processes that specific tenant.
 * 2. Coordinator Mode: No `userId` -> scans active integrations and processes each tenant within their local business hours.
 */
export const handler = async (event: any) => {
  console.log('🚀 Starting daily email outreach agent with event:', JSON.stringify(event || {}));

  try {
    // 1. Single-Tenant Mode
    if (event?.userId) {
      const scanResult = await dynamoClient.send(new ScanCommand({
        TableName: process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME,
        FilterExpression: 'userId = :userId AND isActive = :active',
        ExpressionAttributeValues: {
          ':userId': { S: event.userId },
          ':active': { BOOL: true }
        }
      }));

      if (!scanResult.Items || scanResult.Items.length === 0) {
        return {
          statusCode: 404,
          body: JSON.stringify({ success: false, message: `No active integration found for user ${event.userId}` })
        };
      }

      const item = scanResult.Items[0];
      const integration: GHLIntegration = {
        id: item.id.S!,
        userId: item.userId.S!,
        locationId: item.locationId.S!,
        accessToken: item.accessToken.S!,
        campaignEmail: item.campaignEmail?.S || undefined,
        emailSignature: item.emailSignature?.S || undefined,
        timezone: item.timezone?.S || undefined,
      };

      const result = await processTenantIntegration(integration);
      return {
        statusCode: 200,
        body: JSON.stringify({ success: result.success, userId: event.userId, emailsSent: result.emailsSent, reason: result.reason })
      };
    }

    // 2. Coordinator / Hourly Cron Mode
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
      return { statusCode: 200, body: JSON.stringify({ success: true, message: 'No integrations to process' }) };
    }

    const integrations: GHLIntegration[] = result.Items.map(item => ({
      id: item.id.S!,
      userId: item.userId.S!,
      locationId: item.locationId.S!,
      accessToken: item.accessToken.S!,
      campaignEmail: item.campaignEmail?.S || undefined,
      emailSignature: item.emailSignature?.S || undefined,
      timezone: item.timezone?.S || undefined,
    }));

    console.log(`Found ${integrations.length} active integrations across all tenants`);

    let totalEmailsSent = 0;
    const summary: Record<string, any> = {};

    for (const integration of integrations) {
      const tenantResult = await processTenantIntegration(integration);
      totalEmailsSent += tenantResult.emailsSent;
      summary[integration.userId] = tenantResult;
    }

    console.log(`\n✅ Daily email outreach coordinator complete. Total emails sent across all tenants: ${totalEmailsSent}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        totalEmailsSent,
        tenantsProcessed: integrations.length,
        summary,
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
