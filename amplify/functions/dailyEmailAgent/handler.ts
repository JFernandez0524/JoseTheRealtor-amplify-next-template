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
 * Daily Email Outreach Agent
 * 
 * Runs every day at 9 AM EST
 * Finds contacts with "ai outreach" tag who haven't been emailed
 * Sends personalized email using AMMO framework
 * 
 * COMPLIANCE:
 * - Monday-Friday: 9 AM - 7 PM EST
 * - Saturday: 9 AM - 12 PM EST
 * - Sunday: Closed
 * - Rate limited to 2 seconds between emails
 * 
 * WORKFLOW:
 * 1. Get all active GHL integrations with campaignEmail configured
 * 2. For each integration, search for contacts with "ai outreach" tag
 * 3. Filter out contacts who have already been emailed
 * 4. Send email to each eligible contact
 * 5. Rate limit: 2 seconds between emails
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
