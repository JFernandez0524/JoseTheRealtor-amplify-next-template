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

const CALL_OUTCOME_FIELD_ID = 'LNyfm5JDal955puZGbu3';

// Dispositions that should stop AI outreach
const STOP_DISPOSITIONS = [
  'Sold Already',
  'Not Interested',
  'DNC',
  'Listed With Realtor',
  'Wrong Number / Disconnected / Invalid Number'
];

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

    // Get call outcome from custom fields (GHL sends as root-level properties)
    const callOutcome = payload[CALL_OUTCOME_FIELD_ID];
    
    if (!callOutcome) {
      console.log('⚠️ [DISPOSITION] No call outcome in payload');
      return NextResponse.json({ success: true, message: 'No disposition to process' });
    }

    console.log(`📞 [DISPOSITION] Call outcome: ${callOutcome}`);

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
