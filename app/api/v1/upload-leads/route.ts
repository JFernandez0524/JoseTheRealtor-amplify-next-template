import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    const text = await file.text();
    const leads = parseCSV(text);
    
    return NextResponse.json({
      success: true,
      leadsFound: leads.length,
      leads: leads.slice(0, 5), // Preview first 5
      message: `Found ${leads.length} leads. Use /process-leads to skip trace and send to GHL.`
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

function parseCSV(csvText: string) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  const leads = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const lead: any = {};
    
    headers.forEach((header, index) => {
      const value = values[index] || '';
      
      // Map common CSV headers to our lead format
      switch (header) {
        case 'first_name':
        case 'firstname':
        case 'first name':
          lead.firstName = value;
          break;
        case 'last_name':
        case 'lastname':
        case 'last name':
          lead.lastName = value;
          break;
        case 'property_address':
        case 'property address':
        case 'address':
          lead.propertyAddress = value;
          break;
        case 'property_city':
        case 'property city':
        case 'city':
          lead.propertyCity = value;
          break;
        case 'property_state':
        case 'property state':
        case 'state':
          lead.propertyState = value;
          break;
        case 'property_zip':
        case 'property zip':
        case 'zip':
        case 'zipcode':
          lead.propertyZip = value;
          break;
        case 'owner_address':
        case 'owner address':
        case 'mailing_address':
        case 'mailing address':
          lead.ownerAddress = value;
          break;
        case 'owner_city':
        case 'owner city':
        case 'mailing_city':
        case 'mailing city':
          lead.ownerCity = value;
          break;
        case 'owner_state':
        case 'owner state':
        case 'mailing_state':
        case 'mailing state':
          lead.ownerState = value;
          break;
        case 'owner_zip':
        case 'owner zip':
        case 'mailing_zip':
        case 'mailing zip':
          lead.ownerZip = value;
          break;
        case 'lead_type':
        case 'lead type':
        case 'type':
          lead.leadType = value.toLowerCase().includes('probate') ? 'Probate' : 'Preforeclosure';
          break;
      }
    });
    
    // Validate required fields
    if (lead.propertyAddress && lead.propertyCity && lead.propertyState) {
      // Set default lead type if not specified
      if (!lead.leadType) {
        lead.leadType = 'Probate'; // Default
      }
      
      leads.push(lead);
    }
  }
  
  return leads;
}
