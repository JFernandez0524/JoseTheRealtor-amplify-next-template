/**
 * GHL Manual Disposition Webhook
 * 
 * Handles manual call dispositions set in GHL (e.g., "Sold Already", "Not Interested")
 * Stops AI outreach and allows GHL workflows to take over
 * 
 * Trigger: GHL Workflow → Contact Custom Field Updated (Call Outcome)
 * 
 * GHL sends standard webhook payload with contact data and custom fields
 */

import { NextResponse } from 'next/server';
import { updateSmsStatus, updateEmailStatus, findQueueItemByContactId } from '@/amplify/functions/shared/outreachQueue';
import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';

const CALL_OUTCOME_FIELD_ID = 'LNyfm5JDal955puZGbu3';

// Dispositions that should stop AI outreach (dead leads)
const STOP_DISPOSITIONS = [
  'Not Interested',
  'Incorrect Number',
  'Wrong Number / Disconnected / Invalid Number', // GHL actual value
  'Listed With Realtor',
  'Sold Already',
  'DNC'
];

// Dispositions that clear phone numbers
const WRONG_NUMBER_DISPOSITIONS = [
  'Incorrect Number',
  'Wrong Number / Disconnected / Invalid Number'
];

// Dispositions that keep AI outreach active
// - No Answer: Keep trying
// - Voicemail: Keep trying
// - Follow Up: Still interested
// - Requested Appointment: Hot lead, continue until appointment confirmed

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log('📞 [DISPOSITION] Received webhook:', JSON.stringify(payload, null, 2));

    // GHL sends contact.id in the root payload
    const contactId = payload.id || payload.contactId;
    const locationId = payload.location?.id;

    if (!contactId) {
      return NextResponse.json({ error: 'Missing contact ID' }, { status: 400 });
    }

    // Get call outcome from custom fields array or root-level property
    let callOutcome = payload[CALL_OUTCOME_FIELD_ID]; // Root-level (custom data)
    
    if (!callOutcome && payload.customFields) {
      // Extract from customFields array
      const field = payload.customFields.find((f: any) => f.id === CALL_OUTCOME_FIELD_ID);
      callOutcome = field?.value;
    }
    
    if (!callOutcome) {
      console.log('⚠️ [DISPOSITION] No call outcome in payload');
      return NextResponse.json({ success: true, message: 'No disposition to process' });
    }

    console.log(`📞 [DISPOSITION] Call outcome: ${callOutcome}`);

    // Update Last Call Date for ALL dispositions (manual calls)
    try {
      const { data: integrations } = await cookiesClient.models.GhlIntegration.list({
        filter: { 
          locationId: { eq: locationId },
          isActive: { eq: true }
        }
      });

      if (integrations && integrations.length > 0) {
        const { getValidGhlToken } = await import('@/app/utils/aws/data/ghlIntegration.server');
        const accessToken = await getValidGhlToken(integrations[0].userId);

        if (accessToken) {
          const axios = (await import('axios')).default;
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
          
          await axios.put(
            `https://services.leadconnectorhq.com/contacts/${contactId}`,
            { 
              customFields: [
                { id: 'dWNGeSckpRoVUxXLgxMj', value: today } // Last Call Date
              ]
            },
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Version': '2021-07-28'
              }
            }
          );
          
          console.log(`✅ [DISPOSITION] Updated Last Call Date to ${today}`);
        }
      }
    } catch (dateError) {
      console.error(`⚠️ [DISPOSITION] Failed to update Last Call Date:`, dateError);
      // Don't fail the webhook if date update fails
    }

    // Check if this disposition should stop AI outreach
    if (STOP_DISPOSITIONS.includes(callOutcome)) {
      console.log(`🛑 [DISPOSITION] Stopping AI outreach for contact ${contactId}`);

      // Find queue item by contactId (scan operation)
      const queueItem = await findQueueItemByContactId(contactId);
      
      if (queueItem) {
        const queueId = `${queueItem.userId}_${contactId}`;
        
        // Stop both SMS and email outreach
        await updateSmsStatus(queueId, 'OPTED_OUT');
        await updateEmailStatus(queueId, 'OPTED_OUT');
        
        console.log(`✅ [DISPOSITION] Stopped outreach for ${contactId} - Reason: ${callOutcome}`);
        
        // Update PropertyLead with call outcome
        try {
          // Find lead by ghlContactId
          const { data: leads } = await cookiesClient.models.PropertyLead.list({
            filter: { ghlContactId: { eq: contactId } }
          });
          
          if (leads && leads.length > 0) {
            const lead = leads[0];
            const currentOutreachData = (lead.ghlOutreachData as any) || {};
            
            await cookiesClient.models.PropertyLead.update({
              id: lead.id,
              ghlOutreachData: {
                ...currentOutreachData,
                callOutcome,
                smsStatus: 'OPTED_OUT',
                emailStatus: 'OPTED_OUT'
              }
            });
            
            console.log(`✅ [DISPOSITION] Updated PropertyLead ${lead.id} with call outcome`);
          }
        } catch (leadError) {
          console.error(`⚠️ [DISPOSITION] Failed to update PropertyLead:`, leadError);
          // Don't fail the webhook if lead update fails
        }
        
        return NextResponse.json({
          success: true,
          message: `AI outreach stopped for disposition: ${callOutcome}`,
          contactId,
          disposition: callOutcome
        });
      } else {
        console.log(`⚠️ [DISPOSITION] Contact ${contactId} not found in queue`);
        return NextResponse.json({
          success: true,
          message: 'Contact not in outreach queue'
        });
      }
    }

    // Disposition doesn't require stopping outreach
    console.log(`ℹ️ [DISPOSITION] Disposition "${callOutcome}" does not stop outreach`);
    return NextResponse.json({
      success: true,
      message: 'Disposition recorded, outreach continues'
    });

  } catch (error) {
    console.error('❌ [DISPOSITION] Webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process disposition webhook' },
      { status: 500 }
    );
  }
}
