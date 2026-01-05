import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { contactId } = await req.json();
    
    if (!contactId) {
      return NextResponse.json({ error: 'contactId required' }, { status: 400 });
    }

    // Get the contact details to analyze
    const response = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
        'Version': '2021-07-28'
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const contactData = await response.json();
    const contact = contactData.contact;
    
    // Analyze the contact for testing
    const analysis = {
      contactInfo: {
        id: contact.id,
        name: contact.contactName,
        phone: contact.phone || 'None',
        email: contact.email || 'None',
        source: contact.source
      },
      
      tags: contact.tags || [],
      
      customFields: contact.customFields?.reduce((acc: any, field: any) => {
        // Map field IDs to readable names
        const fieldMap: any = {
          'PBInTgsd2nMCD3Ngmy0a': 'Lead Source ID',
          'p3NOYiInAERYbe0VsLHB': 'Property Address',
          'h4UIjKQvFu7oRW4SAY8W': 'Property City',
          '9r9OpQaxYPxqbA6Hvtx7': 'Property State',
          'hgbjsTVwcyID7umdhm2o': 'Property Zip',
          'oaf4wCuM3Ub9eGpiddrO': 'Lead Type',
          'pGfgxcdFaYAkdq0Vp53j': 'Contact Type',
          'HrnY1GUZ7P6d6r7J0ZRc': 'Skip Trace Status'
        };
        
        const fieldName = fieldMap[field.id] || field.id;
        acc[fieldName] = field.value;
        return acc;
      }, {}),
      
      workflowStatus: {
        hasDialerTag: contact.tags?.includes('start dialing campaign'),
        hasDirectMailTag: contact.tags?.includes('Direct-Mail-Only'),
        isPrimary: contact.tags?.includes('primary_contact'),
        isMultiPhone: contact.tags?.includes('multi-phone-lead'),
        isDirectMailEligible: contact.tags?.includes('direct_mail_eligible')
      },
      
      testResults: {
        shouldTriggerDialer: contact.phone && contact.tags?.includes('start dialing campaign'),
        shouldTriggerDirectMail: !contact.phone && contact.tags?.includes('Direct-Mail-Only'),
        properSetup: contact.customFields?.some((f: any) => f.id === 'PBInTgsd2nMCD3Ngmy0a')
      }
    };
    
    return NextResponse.json({
      success: true,
      analysis,
      recommendations: generateTestRecommendations(analysis)
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

function generateTestRecommendations(analysis: any) {
  const recommendations = [];
  
  if (!analysis.testResults.properSetup) {
    recommendations.push('❌ Missing Lead Source ID - check sync process');
  }
  
  if (analysis.contactInfo.phone && !analysis.workflowStatus.hasDialerTag) {
    recommendations.push('⚠️ Has phone but no dialer tag - check skip trace status');
  }
  
  if (!analysis.contactInfo.phone && !analysis.workflowStatus.hasDirectMailTag) {
    recommendations.push('⚠️ No phone but no direct mail tag - check routing logic');
  }
  
  if (analysis.workflowStatus.hasDialerTag && analysis.workflowStatus.hasDirectMailTag) {
    recommendations.push('🚨 Has both dialer AND direct mail tags - conflict!');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ Contact setup looks correct for testing');
  }
  
  return recommendations;
}
