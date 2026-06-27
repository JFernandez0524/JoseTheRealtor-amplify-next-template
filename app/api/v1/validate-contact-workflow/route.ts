/**
 * POST /api/v1/validate-contact-workflow
 *
 * Debug/admin utility that inspects a GHL contact's current workflow state —
 * tags, custom field values, lead type, contact type, and AI state.
 * Used to troubleshoot contacts that are not progressing through outreach workflows.
 *
 * AUTH: None (uses GHL_API_KEY env var directly — internal/admin use only)
 * REQUEST BODY: { contactId: string }
 * RESPONSE: { success: true, contactId, contactName, analysis: {...} }
 *
 * NOTE: Not user-scoped. Do not expose in production UI without auth guard.
 */
import { NextResponse } from 'next/server';
import { ghlGetContact } from '../../../../amplify/functions/shared/ghlClient';

export async function POST(req: Request) {
  try {
    const { contactId } = await req.json();

    if (!contactId) {
      return NextResponse.json({ error: 'contactId required' }, { status: 400 });
    }

    const contact = await ghlGetContact(process.env.GHL_API_KEY!, contactId);
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Analyze workflow state
    const analysis = analyzeContactWorkflow(contact);
    
    return NextResponse.json({
      success: true,
      contactId,
      contactName: contact.contactName,
      analysis
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

function analyzeContactWorkflow(contact: any) {
  const tags = contact.tags || [];
  const customFields = contact.customFields || [];
  
  // Get key field values
  const leadType = customFields.find((f: any) => f.id === 'oaf4wCuM3Ub9eGpiddrO')?.value;
  const contactType = customFields.find((f: any) => f.id === 'pGfgxcdFaYAkdq0Vp53j')?.value;
  const leadSourceId = customFields.find((f: any) => f.id === 'PBInTgsd2nMCD3Ngmy0a')?.value;
  
  const analysis = {
    contactInfo: {
      hasPhone: !!contact.phone,
      hasEmail: !!contact.email,
      leadType,
      contactType,
      leadSourceId: leadSourceId ? 'Present' : 'Missing'
    },
    
    workflowState: {
      isPrimaryContact: tags.includes('primary_contact'),
      isDirectMailOnly: tags.includes('direct-mail-only'),
      isMultiPhoneLead: tags.includes('multi-phone-lead'),
      hasActiveCampaign: tags.some((tag: string) => tag.includes('campaign')),
      isDirectMailEligible: tags.includes('direct_mail_eligible')
    },
    
    aiEligibility: {
      hasPhone: !!contact.phone,
      hasValidLeadType: ['Probate', 'PREFORECLOSURE', 'Preforeclosure'].includes(leadType),
      notDirectMailOnly: contactType !== 'Direct Mail',
      wouldEnableAI: (() => {
        const hasPhone = !!contact.phone;
        const hasValidLeadType = ['Probate', 'PREFORECLOSURE', 'Preforeclosure'].includes(leadType);
        const notDirectMailOnly = contactType !== 'Direct Mail';
        return hasPhone && hasValidLeadType && notDirectMailOnly;
      })()
    },
    
    campaignFlow: {
      currentState: determineCurrentState(contact, tags),
      nextActions: determineNextActions(contact, tags, leadType, contactType),
      safetyChecks: {
        primaryContactProtected: tags.includes('primary_contact'),
        hasLeadSourceId: !!leadSourceId
      }
    },
    
    recommendations: generateRecommendations(contact, tags, leadType, contactType)
  };
  
  return analysis;
}

function determineCurrentState(contact: any, tags: string[]) {
  if (tags.includes('direct-mail-only')) return 'Direct Mail Only';
  if (tags.includes('start dialing campaign')) return 'Cold Calling Campaign';
  if (tags.includes('mail_campaign_active')) return 'Mail Campaign Active';
  if (contact.phone && !tags.includes('direct-mail-only')) return 'Ready for SMS/AI';
  return 'New Lead - Needs Classification';
}

function determineNextActions(contact: any, tags: string[], leadType: string, contactType: string) {
  const actions = [];
  
  if (!contact.phone && !contact.email) {
    actions.push('Skip trace for contact information');
  }
  
  if (contact.phone && !tags.includes('start dialing campaign') && contactType !== 'Direct Mail') {
    actions.push('Add to SMS/AI campaign');
  }
  
  if (!tags.includes('direct_mail_eligible') && leadType) {
    actions.push('Tag as direct mail eligible');
  }
  
  if (tags.includes('multi-phone-lead') && !tags.includes('primary_contact')) {
    actions.push('Verify if this should be primary contact');
  }
  
  return actions;
}

function generateRecommendations(contact: any, tags: string[], leadType: string, contactType: string) {
  const recommendations = [];
  
  // AI System Recommendations
  if (contact.phone && ['Probate', 'PREFORECLOSURE', 'Preforeclosure'].includes(leadType) && contactType !== 'Direct Mail') {
    recommendations.push({
      type: 'AI_READY',
      message: 'Contact is ready for AI text campaigns',
      priority: 'HIGH'
    });
  }
  
  // Campaign Flow Recommendations
  if (tags.includes('start dialing campaign') && !contact.phone) {
    recommendations.push({
      type: 'DATA_ISSUE',
      message: 'Tagged for dialing but no phone number',
      priority: 'HIGH'
    });
  }
  
  // Safety Recommendations
  if (tags.includes('multi-phone-lead') && !tags.includes('primary_contact')) {
    recommendations.push({
      type: 'SAFETY',
      message: 'Multi-phone lead without primary contact protection',
      priority: 'MEDIUM'
    });
  }
  
  return recommendations;
}
