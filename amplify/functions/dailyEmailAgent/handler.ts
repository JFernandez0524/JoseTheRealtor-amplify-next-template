import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import axios from "axios";
import { isWithinBusinessHours, getNextBusinessHourMessage } from '../shared/businessHours';

const dynamoClient = new DynamoDBClient({});

interface GHLIntegration {
  id: string;
  userId: string;
  locationId: string;
  accessToken: string;
  campaignEmail?: string;
}

/**
 * DAILY EMAIL OUTREACH AGENT
 * 
 * Automated Lambda function that sends personalized prospecting emails to leads
 * using the AMMO framework (Audience-Message-Method-Outcome).
 * 
 * SCHEDULE:
 * - Runs every hour (configured in resource.ts)
 * - Only sends during business hours (Mon-Fri 9AM-7PM, Sat 9AM-12PM EST)
 * - Sunday: No emails sent
 * 
 * WORKFLOW:
 * 1. Check if within business hours (exit if not)
 * 2. Scan DynamoDB for active GHL integrations with campaignEmail configured
 * 3. For each integration:
 *    a. Search GHL for contacts with "ai outreach" tag
 *    b. Filter contacts who haven't been emailed (email_attempt_counter = 0)
 *    c. Send personalized email via /api/v1/send-email-to-contact
 *    d. Update email_attempt_counter to 1
 * 4. Rate limit: 2 seconds between emails
 * 
 * EMAIL CONTENT:
 * - Subject: "Clarity on [Property Address]"
 * - Professional salutation (name only, no "Hi/Hello")
 * - Bullet points for cash offer and retail value
 * - Signature block with contact information
 * - Personalized with property details and Zestimate values
 * 
 * TRACKING:
 * - email_attempt_counter: Incremented after sending
 * - last_email_date: Updated with send timestamp
 * - Prevents duplicate emails to same contact
 * 
 * ENVIRONMENT VARIABLES:
 * - GHL_INTEGRATION_TABLE_NAME: DynamoDB table for GHL integrations
 * - APP_URL: Base URL for API calls (e.g., https://leads.josetherealtor.com)
 * 
 * RELATED FILES:
 * - /api/v1/send-email-to-contact - API route for email generation
 * - /utils/ai/emailConversationHandler - Email content generator
 * - /api/v1/ghl-email-webhook - Handles email replies
 * - shared/businessHours - Business hours checker
 * 
 * MONITORING:
 * - CloudWatch logs: /aws/lambda/dailyEmailAgent
 * - Metrics: Total emails sent, success/failure counts
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
    // Get all GHL integrations
    const scanCommand = new ScanCommand({
      TableName: process.env.GHL_INTEGRATION_TABLE_NAME,
      FilterExpression: 'attribute_exists(accessToken) AND attribute_exists(campaignEmail)',
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
      campaignEmail: item.campaignEmail?.S,
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
      
      try {
        // Search for contacts with "ai outreach" tag
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
              'Authorization': `Bearer ${integration.accessToken}`,
              'Content-Type': 'application/json',
              'Version': '2021-07-28'
            }
          }
        );

        const contacts = searchResponse.data.contacts || [];
        console.log(`Found ${contacts.length} contacts with "ai outreach" tag`);

        // Filter contacts who haven't been emailed yet
        const eligibleContacts = contacts.filter((contact: any) => {
          const emailAttemptCounter = contact.customFields?.find((f: any) => f.id === '0MD4Pp2LCyOSCbCjA5qF')?.value;
          const hasEmail = contact.email;
          
          // Only send to contacts with email who haven't been emailed (counter = 0 or null)
          return hasEmail && (!emailAttemptCounter || emailAttemptCounter === 0 || emailAttemptCounter === '0');
        });

        console.log(`${eligibleContacts.length} contacts eligible for email outreach`);

        // Send email to each eligible contact
        for (const contact of eligibleContacts) {
          try {
            console.log(`Sending email to contact ${contact.id} (${contact.email})`);
            
            const response = await axios.post(
              `${process.env.APP_URL}/api/v1/send-email-to-contact`,
              {
                contactId: contact.id,
                accessToken: integration.accessToken,
                fromEmail: integration.campaignEmail
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
              
              // Update email counter
              await axios.put(
                `https://services.leadconnectorhq.com/contacts/${contact.id}`,
                {
                  customFields: [
                    { id: '0MD4Pp2LCyOSCbCjA5qF', value: 1 }
                  ]
                },
                {
                  headers: {
                    'Authorization': `Bearer ${integration.accessToken}`,
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
