import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

interface LeadData {
  firstName?: string;
  lastName?: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  leadType: 'Probate' | 'Preforeclosure';
  ownerAddress?: string;
  ownerCity?: string;
  ownerState?: string;
  ownerZip?: string;
}

export async function POST(req: Request) {
  try {
    const { leads }: { leads: LeadData[] } = await req.json();
    
    if (!leads || !Array.isArray(leads)) {
      return NextResponse.json({ error: 'leads array required' }, { status: 400 });
    }

    const results = [];
    
    for (const lead of leads) {
      try {
        // 1. Generate unique lead source ID
        const leadSourceId = uuidv4();
        
        // 2. Skip trace the lead
        const skipTraceResult = await skipTraceLead(lead);
        
        // 3. Process each contact found
        const contactResults = [];
        
        if (skipTraceResult.contacts && skipTraceResult.contacts.length > 0) {
          for (let i = 0; i < skipTraceResult.contacts.length; i++) {
            const contact = skipTraceResult.contacts[i];
            const isPrimary = i === 0; // First contact is primary
            
            // 4. Create contact in GHL
            const ghlContact = await createGHLContact({
              ...lead,
              ...contact,
              leadSourceId,
              isPrimary
            });
            
            contactResults.push(ghlContact);
          }
        } else {
          // No contacts found - create direct mail only contact
          const ghlContact = await createGHLContact({
            ...lead,
            leadSourceId,
            isPrimary: true,
            directMailOnly: true
          });
          
          contactResults.push(ghlContact);
        }
        
        results.push({
          success: true,
          leadSourceId,
          originalLead: lead,
          contactsCreated: contactResults.length,
          contacts: contactResults
        });
        
      } catch (error: any) {
        results.push({
          success: false,
          originalLead: lead,
          error: error.message
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      processed: leads.length,
      results
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function skipTraceLead(lead: LeadData) {
  // Mock skip trace - replace with your actual skip trace API
  // This should return: { contacts: [{ firstName, lastName, phone, email }] }
  
  // For now, return mock data
  return {
    contacts: [
      {
        firstName: lead.firstName || 'Unknown',
        lastName: lead.lastName || 'Owner',
        phone: '+1555123456', // Mock phone
        email: 'test@example.com' // Mock email
      }
    ]
  };
  
  // TODO: Replace with actual skip trace API call
  // const response = await fetch('YOUR_SKIP_TRACE_API', {
  //   method: 'POST',
  //   headers: { 'Authorization': `Bearer ${process.env.SKIP_TRACE_API_KEY}` },
  //   body: JSON.stringify(lead)
  // });
  // return await response.json();
}

async function createGHLContact(data: any) {
  const {
    firstName,
    lastName,
    phone,
    email,
    propertyAddress,
    propertyCity,
    propertyState,
    propertyZip,
    ownerAddress,
    ownerCity,
    ownerState,
    ownerZip,
    leadType,
    leadSourceId,
    isPrimary,
    directMailOnly
  } = data;
  
  // Determine campaign assignment
  const hasPhone = !!phone;
  const campaignType = directMailOnly || !hasPhone ? 'Direct Mail' : 'SMS Campaign';
  
  // Build tags
  const tags = [
    leadType.toLowerCase(),
    'direct_mail_eligible'
  ];
  
  if (isPrimary) tags.push('primary_contact');
  if (!hasPhone || directMailOnly) tags.push('direct-mail-only');
  if (hasPhone && !directMailOnly) tags.push('sms-campaign-ready');
  
  // Build custom fields
  const customFields = [
    { id: 'p3NOYiInAERYbe0VsLHB', value: propertyAddress },
    { id: 'h4UIjKQvFu7oRW4SAY8W', value: propertyCity },
    { id: '9r9OpQaxYPxqbA6Hvtx7', value: propertyState },
    { id: 'hgbjsTVwcyID7umdhm2o', value: propertyZip },
    { id: 'oaf4wCuM3Ub9eGpiddrO', value: leadType.toUpperCase() },
    { id: 'PBInTgsd2nMCD3Ngmy0a', value: leadSourceId },
    { id: 'pGfgxcdFaYAkdq0Vp53j', value: campaignType },
    { id: 'HrnY1GUZ7P6d6r7J0ZRc', value: 'COMPLETED' }
  ];
  
  // Add owner address if different from property
  if (ownerAddress) {
    customFields.push(
      { id: '2RCYsC2cztJ1TWTh0tLt', value: ownerAddress },
      { id: '2F48dc4QEAOFHNgBNVcu', value: ownerCity || propertyCity },
      { id: 'WzTPYXsXyPcnFSWn2UFf', value: ownerState || propertyState },
      { id: 'Vx4EIVAsIK3ej5jEv3Bm', value: ownerZip || propertyZip }
    );
  }
  
  // Create contact in GHL
  const response = await fetch('https://services.leadconnectorhq.com/contacts/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28'
    },
    body: JSON.stringify({
      firstName: firstName || 'Unknown',
      lastName: lastName || 'Owner',
      phone: phone || null,
      email: email || null,
      locationId: process.env.GHL_LOCATION_ID,
      source: 'JTR_Lead_Processor',
      tags,
      customFields,
      country: 'US'
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create GHL contact: ${response.statusText}`);
  }
  
  const result = await response.json();
  
  return {
    contactId: result.contact.id,
    name: `${firstName || 'Unknown'} ${lastName || 'Owner'}`,
    phone: phone || 'None',
    email: email || 'None',
    campaignType,
    tags,
    isPrimary
  };
}
