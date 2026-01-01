import { NextResponse } from 'next/server';
import axios from 'axios';

const GHL_API_KEY = process.env.GHL_API_KEY;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const {
      type,
      contactId,
      contact,
      campaignId,
      status
    } = body;

    // Handle campaign status updates
    if (type === 'CampaignStatusUpdate') {
      await handleCampaignStatus(contactId, contact, status);
    }

    // Handle contact tag updates for bad numbers
    if (type === 'ContactTagUpdate' && body.tags?.includes('Bad-Number')) {
      await handleBadNumber(contactId, contact);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Campaign webhook error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function handleCampaignStatus(contactId: string, contact: any, status: string) {
  try {
    const leadSourceId = contact?.customFields?.find((f: any) => f.id === 'PBInTgsd2nMCD3Ngmy0a')?.value;
    
    if (status === 'no_response' || status === 'failed') {
      // Check if this contact has siblings (same lead_source_id)
      const searchResponse = await axios.post(
        'https://services.leadconnectorhq.com/contacts/search',
        {
          locationId: process.env.GHL_LOCATION_ID,
          filters: [
            { field: 'customField', customFieldId: 'PBInTgsd2nMCD3Ngmy0a', operator: 'eq', value: leadSourceId }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${GHL_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const siblings = searchResponse.data?.contacts || [];
      
      if (siblings.length > 1) {
        // Delete this specific contact (bad number)
        await axios.delete(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
          headers: { 'Authorization': `Bearer ${GHL_API_KEY}` }
        });
        console.log(`Deleted contact ${contactId} - bad number with siblings`);
      } else {
        // Last contact for this lead - move to direct mail
        await axios.post(
          `https://services.leadconnectorhq.com/contacts/${contactId}/tags`,
          { tags: ['Move-To-Direct-Mail'] },
          {
            headers: {
              'Authorization': `Bearer ${GHL_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        // Update contact type to Direct Mail
        await axios.put(
          `https://services.leadconnectorhq.com/contacts/${contactId}`,
          {
            customFields: [
              { id: 'pGfgxcdFaYAkdq0Vp53j', value: 'Direct Mail' },
              { id: '1NxQW2kKMVgozjSUuu7s', value: 'paused' } // Pause AI for direct mail
            ]
          },
          {
            headers: {
              'Authorization': `Bearer ${GHL_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log(`Moved contact ${contactId} to direct mail - last number for lead`);
      }
    }

    if (status === 'responded' || status === 'qualified') {
      // Tag for human follow-up
      await axios.post(
        `https://services.leadconnectorhq.com/contacts/${contactId}/tags`,
        { tags: ['Qualified-Lead', 'Ready-For-Human-Contact'] },
        {
          headers: {
            'Authorization': `Bearer ${GHL_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`Tagged contact ${contactId} as qualified lead`);
    }

  } catch (error) {
    console.error('Campaign status handling error:', error);
  }
}

async function handleBadNumber(contactId: string, contact: any) {
  try {
    const leadSourceId = contact?.customFields?.find((f: any) => f.id === 'PBInTgsd2nMCD3Ngmy0a')?.value;
    
    // Find siblings with same lead_source_id
    const searchResponse = await axios.post(
      'https://services.leadconnectorhq.com/contacts/search',
      {
        locationId: process.env.GHL_LOCATION_ID,
        filters: [
          { field: 'customField', customFieldId: 'PBInTgsd2nMCD3Ngmy0a', operator: 'eq', value: leadSourceId }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const siblings = searchResponse.data?.contacts || [];
    
    if (siblings.length > 1) {
      // Delete this bad number contact
      await axios.delete(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
        headers: { 'Authorization': `Bearer ${GHL_API_KEY}` }
      });
      console.log(`Deleted bad number contact ${contactId}`);
    } else {
      // Last contact - convert to direct mail
      await axios.put(
        `https://services.leadconnectorhq.com/contacts/${contactId}`,
        {
          phone: '', // Remove bad phone
          customFields: [
            { id: 'pGfgxcdFaYAkdq0Vp53j', value: 'Direct Mail' },
            { id: '1NxQW2kKMVgozjSUuu7s', value: 'paused' } // Pause AI
          ],
          tags: ['Direct-Mail-Only', 'Bad-Phone-Removed']
        },
        {
          headers: {
            'Authorization': `Bearer ${GHL_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`Converted contact ${contactId} to direct mail only`);
    }

  } catch (error) {
    console.error('Bad number handling error:', error);
  }
}
