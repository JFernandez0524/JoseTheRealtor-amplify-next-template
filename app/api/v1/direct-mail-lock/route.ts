import { NextResponse } from 'next/server';
import axios from 'axios';

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_HEADERS = {
  Authorization: `Bearer ${GHL_API_KEY}`,
  'Content-Type': 'application/json',
  Version: '2021-07-28'
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { contactId, leadSourceId } = body;
    
    if (!contactId || !leadSourceId) {
      return NextResponse.json({ error: 'contactId and leadSourceId required' }, { status: 400 });
    }

    // 🛡️ BULLETPROOF DIRECT MAIL DEDUPE
    // Check if any sibling has already been mailed using leadSourceId
    const searchResponse = await axios.post(
      'https://services.leadconnectorhq.com/contacts/search',
      {
        locationId: process.env.GHL_LOCATION_ID,
        filters: [
          { field: 'customField', customFieldId: 'PBInTgsd2nMCD3Ngmy0a', operator: 'eq', value: leadSourceId }
        ]
      },
      { headers: GHL_HEADERS }
    );

    const siblings = searchResponse.data?.contacts || [];
    
    // Check if any sibling already has DM_Lock tag
    const alreadyMailed = siblings.some(contact => 
      contact.tags?.includes('DM_Lock') || contact.tags?.includes('Direct_Mail_Sent')
    );

    if (alreadyMailed) {
      return NextResponse.json({
        success: false,
        action: 'SKIP',
        message: 'Lead already mailed - sibling has DM_Lock tag',
        leadSourceId
      });
    }

    // 🔒 ADD DM_LOCK TAG to prevent future duplicates
    await axios.post(
      `https://services.leadconnectorhq.com/contacts/${contactId}/tags`,
      { tags: ['DM_Lock', 'Direct_Mail_Processing'] },
      { headers: GHL_HEADERS }
    );

    return NextResponse.json({
      success: true,
      action: 'PROCEED',
      message: 'Direct mail approved - lock applied',
      contactId,
      leadSourceId
    });

  } catch (error: any) {
    console.error('Direct mail lock error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
