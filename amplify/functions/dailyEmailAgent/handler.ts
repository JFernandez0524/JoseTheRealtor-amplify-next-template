import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import axios from "axios";
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
      campaignEmail: 'jose.fernandez@contact.josetherealtor.com', // GHL verified domain
      emailSignature: item.emailSignature?.S || `
Jose Fernandez
RE/MAX Homeland Realtors
(732) 810-0182
`, // Get email signature from DynamoDB or use default
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
      
      try {
        // 🚀 NEW: Try queue-based approach first (fast, cheap)
        let eligibleContacts: any[] = [];
        let usingQueue = false;
        
        try {
          const { getPendingEmailContacts } = await import('../shared/outreachQueue');
          const queueContacts = await getPendingEmailContacts(integration.userId, 50);
          
          if (queueContacts.length > 0) {
            console.log(`📋 [QUEUE] Found ${queueContacts.length} pending email contacts in queue`);
            eligibleContacts = queueContacts.map((q: any) => ({
              id: q.contactId,
              firstName: q.contactName?.split(' ')[0],
              lastName: q.contactName?.split(' ').slice(1).join(' '),
              email: q.contactEmail,
              customFields: [
                { id: 'p3NOYiInAERYbe0VsLHB', value: q.propertyAddress },
                { id: 'h4UIjKQvFu7oRW4SAY8W', value: q.propertyCity },
                { id: '9r9OpQaxYPxqbA6Hvtx7', value: q.propertyState },
                { id: 'oaf4wCuM3Ub9eGpiddrO', value: q.leadType },
              ],
              _queueId: q.id, // Store queue ID for status updates
              _queueAttempts: q.emailAttempts || 0
            }));
            usingQueue = true;
          } else {
            console.log(`📋 [QUEUE] No pending contacts in queue, falling back to GHL search`);
          }
        } catch (queueError) {
          console.error(`⚠️ [QUEUE] Queue query failed, falling back to GHL search:`, queueError);
        }

        // 🔄 FALLBACK: Use old GHL search method if queue is empty or failed
        if (!usingQueue) {
          const searchResponse = await axios.post(
            'https://services.leadconnectorhq.com/contacts/search',
            {
              locationId: integration.locationId,
              pageLimit: 100,
              filters: [
                {
                  field: 'tags',
                  operator: 'contains',
                  value: 'ai outreach'
                }
              ]
            },
            {
              headers: {
                'Authorization': `Bearer ${validAccessToken}`,
                'Content-Type': 'application/json',
                'Version': '2021-07-28'
              }
            }
          );

          const contacts = searchResponse.data.contacts || [];
          console.log(`Found ${contacts.length} contacts with "ai outreach" tag`);

          // Filter contacts who haven't been emailed yet and have at least one email
          eligibleContacts = contacts.filter((contact: any) => {
            const emailAttemptCounter = contact.customFields?.find((f: any) => f.id === '0MD4Pp2LCyOSCbCjA5qF')?.value;
            
            // Check all email fields (primary + email2 + email3)
            const email2 = contact.customFields?.find((f: any) => f.id === 'JY5nf3NzRwfCGvN5u00E')?.value;
            const email3 = contact.customFields?.find((f: any) => f.id === '1oy6TLKItn5RkebjI7kD')?.value;
            const hasEmail = contact.email || email2 || email3;
            
            // Only send to contacts with at least one email who haven't been emailed (counter = 0 or null)
            return hasEmail && (!emailAttemptCounter || emailAttemptCounter === 0 || emailAttemptCounter === '0');
          });
        }

        console.log(`${eligibleContacts.length} contacts eligible for email outreach`);

        // Send email to each eligible contact
        for (const contact of eligibleContacts) {
          try {
            console.log(`Sending email to contact ${contact.id} (${contact.email})`);
            
            const response = await axios.post(
              `${process.env.APP_URL}/api/v1/send-email-to-contact`,
              {
                contactId: contact.id,
                accessToken: validAccessToken,
                fromEmail: integration.campaignEmail,
                emailSignature: integration.emailSignature
              },
              {
                headers: {
                  'Content-Type': 'application/json'
                }
              }
            );

            if (response.data.success) {
              console.log(`✅ Email sent successfully to ${contact.email}`);
              totalEmailsSent++;
              
              // Update queue status if using queue
              if (usingQueue && contact._queueId) {
                console.log(`📋 [QUEUE] Updating queue item ${contact._queueId}`);
                try {
                  const { updateEmailSent } = await import('../shared/outreachQueue');
                  await updateEmailSent(contact._queueId);
                  console.log(`✅ [QUEUE] Updated queue item ${contact._queueId}`);
                } catch (queueError: any) {
                  console.error(`❌ [QUEUE] Failed to update queue status:`, queueError.message);
                }
              } else {
                console.log(`⚠️ [QUEUE] Not updating queue - usingQueue: ${usingQueue}, _queueId: ${contact._queueId}`);
              }
              
              // Update email counter in GHL (increment, not set to 1)
              const currentCounter = parseInt(contact.customFields?.find((f: any) => f.id === 'wWlrXoXeMXcM6kUexf2L')?.value || '0');
              await axios.put(
                `https://services.leadconnectorhq.com/contacts/${contact.id}`,
                {
                  customFields: [
                    { id: 'wWlrXoXeMXcM6kUexf2L', value: (currentCounter + 1).toString() }, // Increment email_attempt_counter
                    { id: '3xOBr4GvgRc22kBRNYCE', value: new Date().toISOString() } // last_email_date
                  ]
                },
                {
                  headers: {
                    'Authorization': `Bearer ${validAccessToken}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28'
                  }
                }
              );
            } else {
              console.error(`Failed to send email to ${contact.email}:`, response.data.error);
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
