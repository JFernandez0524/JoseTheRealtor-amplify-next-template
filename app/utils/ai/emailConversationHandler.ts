import axios from 'axios';
import { ghlUpdateContact, ghlAddTags, createGhlClient } from '../../../amplify/functions/shared/ghlClient';
import { detectCallOutcomeFromMessage } from '../../../amplify/functions/shared/dispositions';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * EMAIL CONVERSATION HANDLER
 *
 * Handles automated email conversations with leads using the AMMO framework
 * (Audience-Message-Method-Outcome) and Hook-Relate-Bridge-Ask structure.
 *
 * FRAMEWORK:
 * - Hook: Professional salutation (name only, no "Hi/Hello")
 * - Relate: Shows understanding of their probate/foreclosure situation
 * - Bridge: Presents two clear options (cash offer vs retail listing)
 * - Ask: Invites them to meet and discuss options
 *
 * FEATURES:
 * - Generates personalized emails with property-specific details
 * - Includes cash offer (70% of Zestimate) and retail value
 * - Professional formatting with bullet points
 * - Signature block with contact information
 * - Detects handoff keywords for human follow-up
 * - Updates AI state in GHL custom fields
 *
 * USAGE:
 * - Initial outreach: Set incomingMessage to "initial_outreach"
 * - Reply handling: Set incomingMessage to the contact's email body
 * - Test mode: Set testMode to true to prevent sending
 *
 * RELATED FILES:
 * - /api/v1/send-email-to-contact - API route for sending emails
 * - /api/v1/ghl-email-webhook - Webhook for handling replies
 * - amplify/functions/dailyEmailAgent - Lambda for daily automation
 */

interface EmailConversationContext {
  contactId: string;
  conversationId: string;
  incomingMessage: string;
  contactName: string;
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  leadType?: string;
  zestimate?: number;
  sheriffSaleDate?: string;
  estimatedEquitySpread?: number;
  emailSignature?: string;
  locationId: string;
  contact?: any;
  testMode?: boolean;
  fromEmail?: string;
  toEmail?: string;
  accessToken?: string;
  touchNumber?: number; // 1=initial, 2-7=follow-ups
}

interface PropertyAnalysis {
  zestimate?: number;
  sqft?: number;
  beds?: number;
  baths?: number;
  yearBuilt?: number;
}

// Get property analysis
async function getPropertyAnalysis(
  address: string,
  city: string,
  state: string,
  zip: string,
): Promise<PropertyAnalysis | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/analyze-property`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          street: address,
          city,
          state,
          zip,
        }),
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    return {
      zestimate: data.valuation?.zestimate,
      sqft: data.valuation?.livingArea,
      beds: data.valuation?.bedrooms,
      baths: data.valuation?.bathrooms,
      yearBuilt: data.valuation?.yearBuilt,
    };
  } catch (error) {
    console.error('Property analysis error:', error);
    return null;
  }
}

// Send email via GHL
async function sendGHLEmail(
  conversationId: string,
  subject: string,
  body: string,
  accessToken: string,
  testMode = false,
  fromEmail?: string,
  contactId?: string,
  toEmail?: string,
) {
  if (testMode) {
    console.log('🧪 TEST MODE - Would send email:', { subject, body });
    return;
  }

  // Add unsubscribe link to email body
  const unsubscribeLink = contactId
    ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://dealfinder.yourailaunch.com'}/unsubscribe?contact=${contactId}`
    : '';

  const emailWithUnsubscribe = unsubscribeLink
    ? `${body}<br><br><div style="font-size: 11px; color: #999; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">If you no longer wish to receive these emails, you may <a href="${unsubscribeLink}" style="color: #999; text-decoration: underline;">unsubscribe here</a>.</div>`
    : body;

  try {
    console.log(
      `📧 Sending email to GHL ${contactId ? `contact ${contactId}` : `conversation ${conversationId}`}`,
    );

    const messagePayload: any = {
      type: 'Email',
      subject,
      html: emailWithUnsubscribe,
    };

    if (fromEmail) {
      messagePayload.emailFrom = fromEmail;
    }

    if (toEmail) {
      messagePayload.emailTo = toEmail;
    }

    if (contactId) {
      messagePayload.contactId = contactId;
    }

    const ghlPath = contactId
      ? '/conversations/messages'
      : `/conversations/${conversationId}/messages`;

    const ghl = createGhlClient(accessToken);
    await ghl.post(ghlPath, messagePayload);
    console.log('✅ Email sent successfully to GHL');
  } catch (error: any) {
    console.error(
      '❌ Failed to send GHL email:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

export interface LeadTypeContext {
  normalizedType: string;
  displayType: string;
  situationContext: string;
  touch1Relate: string;
  touch4Empathy: string;
  touch5SocialProof: string;
  touch6Urgency: string;
  monthlyNurtureAngle: string;
}

export function getLeadTypeContext(leadType?: string | null): LeadTypeContext {
  const norm = (leadType || '').toUpperCase().replace(/[_\s-]+/g, ' ').trim();

  if (norm.includes('PROBATE')) {
    return {
      normalizedType: 'PROBATE',
      displayType: 'estate / probate',
      situationContext: 'navigate the complexity and stress of settling estates',
      touch1Relate: 'Show empathy for what they are going through with settling the family estate',
      touch4Empathy: 'settling an estate is one of the hardest things a family goes through',
      touch5SocialProof: 'navigating inherited properties and estate settlement get clarity and move forward',
      touch6Urgency: 'probate estates have legal timelines, ongoing carrying costs, and delays can reduce the estate value',
      monthlyNurtureAngle: 'estate settlement or property decisions take time and situations change',
    };
  }

  if (norm.includes('FORECLOSURE')) {
    return {
      normalizedType: 'PREFORECLOSURE',
      displayType: 'pre-foreclosure',
      situationContext: 'understand NJ foreclosure rights, explore options to stay in the home, avoid foreclosure, and protect their equity',
      touch1Relate: 'Acknowledge how overwhelming notice letters can be, and note that public records often lag behind if already resolved or paid',
      touch4Empathy: 'facing foreclosure notices or mortgage challenges is stressful, but NJ homeowners have strong legal rights and court mediation programs',
      touch5SocialProof: 'navigating NJ pre-foreclosure timelines explore loan modification, mediation, and protect their hard-earned equity',
      touch6Urgency: 'NJ foreclosure and auction timelines require timely action so homeowners do not forfeit statutory mediation or adjournment rights',
      monthlyNurtureAngle: 'resolving mortgage challenges or reviewing property decisions takes time and situations change',
    };
  }

  if (norm === 'FSBO' || norm.includes('BY OWNER')) {
    return {
      normalizedType: 'FSBO',
      displayType: 'for-sale-by-owner',
      situationContext: 'sell their home efficiently without the headache of managing showings and unqualified buyers',
      touch1Relate: 'Show respect for their initiative selling directly while recognizing the time and stress of handling buyers and paperwork',
      touch4Empathy: 'managing showings, tire-kickers, and endless paperwork on your own can become exhausting',
      touch5SocialProof: 'who tried selling on their own either secure a direct cash buyer or net top dollar with serious vetted buyers',
      touch6Urgency: 'prolonged days on market can cause buyer fatigue and lead to lowball offers',
      monthlyNurtureAngle: 'selling on your own takes time and market conditions evolve',
    };
  }

  if (norm.includes('TAX')) {
    return {
      normalizedType: 'TAX DELINQUENT',
      displayType: 'property with municipal tax liens',
      situationContext: 'resolve back property taxes and protect their remaining equity',
      touch1Relate: 'Show understanding regarding mounting tax penalties and municipal liens',
      touch4Empathy: 'dealing with mounting municipal tax liens and penalties creates unnecessary financial anxiety',
      touch5SocialProof: 'with tax liens resolve back taxes and walk away with clean cash',
      touch6Urgency: 'municipal tax lien interest compounds quickly and eventually leads to tax deed proceedings',
      monthlyNurtureAngle: 'clearing property liens takes planning and situations change',
    };
  }

  if (norm.includes('VACANT')) {
    return {
      normalizedType: 'VACANT',
      displayType: 'vacant property',
      situationContext: 'eliminate the carrying costs, maintenance, and liability of an empty house',
      touch1Relate: 'Show understanding regarding the burdens and risks of keeping an unoccupied home',
      touch4Empathy: 'maintaining an empty property with taxes, insurance, and upkeep is a constant drain',
      touch5SocialProof: 'with vacant properties turn unused real estate into cash without lifting a paintbrush',
      touch6Urgency: 'vacant properties deteriorate faster and ongoing carrying costs eat into your net proceeds every month',
      monthlyNurtureAngle: 'maintaining an empty property is an ongoing decision and situations change',
    };
  }

  if (norm.includes('DRIVING') || norm.includes('AS IS')) {
    return {
      normalizedType: 'SELL AS IS',
      displayType: 'as-is property',
      situationContext: 'sell a property in need of repairs or updates without spending a dollar out of pocket',
      touch1Relate: 'Show understanding that doing expensive repairs or renovations is often not worth the headache',
      touch4Empathy: 'facing costly home repairs or deferred maintenance can feel completely overwhelming',
      touch5SocialProof: 'sell properties needing major work 100% as-is without doing a single repair or cleaning',
      touch6Urgency: 'repair costs and contractor prices continue to rise while holding costs accumulate',
      monthlyNurtureAngle: 'managing repairs or evaluating an as-is sale takes thought and situations change',
    };
  }

  // General / Other / Default fallback — strictly NEUTRAL, NEVER mentions foreclosure or probate
  return {
    normalizedType: norm || 'OTHER',
    displayType: 'property',
    situationContext: 'explore their selling options and get clarity on property valuation',
    touch1Relate: 'Show understanding that deciding when and how to sell is a significant financial decision',
    touch4Empathy: 'deciding what to do with a property can feel overwhelming with all the competing options out there',
    touch5SocialProof: 'gain total clarity on their property value and choose the right path for their timeline',
    touch6Urgency: 'market conditions and buyer demand shift, so having clear numbers now gives you maximum flexibility',
    monthlyNurtureAngle: 'property decisions take time and situations change',
  };
}

// Generate AI email response using OpenAI
async function generateEmailResponse(
  context: EmailConversationContext,
  propertyData?: PropertyAnalysis,
): Promise<{ subject: string; body: string }> {
  const hasPropertyData = propertyData?.zestimate;
  const hasAddress =
    context.propertyAddress && context.propertyCity && context.propertyState;

  const cashOffer = propertyData?.zestimate
    ? Math.round(propertyData.zestimate * 0.7)
    : null;
  const isReply = context.incomingMessage !== 'initial_outreach';

  const leadContext = getLeadTypeContext(context.leadType);

  const propertyRef = hasAddress
    ? `${context.propertyAddress} in ${context.propertyCity}`
    : 'your property';

  const foreclosureFinancialNotes: string[] = [];
  if (leadContext.normalizedType === 'PREFORECLOSURE') {
    if (context.sheriffSaleDate) {
      foreclosureFinancialNotes.push(`Scheduled Sheriff Sale Date: ${context.sheriffSaleDate}`);
    }
    if (typeof context.estimatedEquitySpread === 'number' && context.estimatedEquitySpread > 0) {
      foreclosureFinancialNotes.push(
        `Estimated Equity to Protect (Market Value minus Upset): ~$${Math.round(context.estimatedEquitySpread).toLocaleString()}`,
      );
    }
  }
  const foreclosureContextLine =
    foreclosureFinancialNotes.length > 0 ? `\n- ${foreclosureFinancialNotes.join('\n- ')}` : '';

  const offerLines = hasPropertyData
    ? `• AS-IS CASH OFFER: $${cashOffer?.toLocaleString()} (quick close, no repairs needed)\n• RETAIL LISTING: $${propertyData!.zestimate?.toLocaleString()} (maximum value, traditional sale)`
    : `• AS-IS CASH OFFER: [we determine after a quick walkthrough]\n• RETAIL LISTING: [market value, traditional sale]`;

  const touch = context.touchNumber ?? 1;

  const sharedRules = `RULES:
- Start with "${context.contactName}," — NO "Hi", "Hello", or "Dear"
- Professional but warm tone
- DO NOT include a signature — it will be added separately
- Return JSON with "subject" and "body" fields only`;

  let systemPrompt: string;
  const isPreforeclosure = leadContext.normalizedType === 'PREFORECLOSURE';

  if (isReply) {
    if (isPreforeclosure) {
      systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors responding to ${context.contactName}'s email regarding their property at ${propertyRef}.

CONTEXT:
- Property: ${propertyRef}${foreclosureContextLine}

THEIR EMAIL: "${context.incomingMessage}"

GUIDELINES FOR PRE-FORECLOSURE REPLIES:
1. If they mention the loan, mortgage, second mortgage, or lien has been paid, cured, or resolved:
   - Congratulate them genuinely!
   - Acknowledge that county court/lis pendens records often lag behind reality by weeks or months.
   - Apologize for reaching out based on outdated public notices, confirm that our records are updated, and assure them no further outreach will be sent.
2. If they object to selling or buying ("can't buy my house", "not for that price", "not selling"):
   - Respect their position immediately. Clarify that you are a local licensed RE/MAX resource and advocate, NOT an opportunistic investor trying to buy houses cheap.
   - Apologize for any misunderstanding, confirm their removal, and wish them well.
3. If they are seeking guidance or exploring options:
   - Provide helpful, factual information on NJ homeowner options (NJ Foreclosure Mediation Program through Superior Court, loan modification, equity protection).
   - Keep it supportive, clear, and pressure-free.

Keep response under 120 words.

${sharedRules}`;
    } else {
      systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors responding to ${context.contactName}'s email about their ${leadContext.displayType} situation.

CONTEXT:
- Property: ${propertyRef}
${hasPropertyData ? `- Cash Offer: $${cashOffer?.toLocaleString()}\n- Retail Value: $${propertyData!.zestimate?.toLocaleString()}` : '- No valuation data yet'}${foreclosureContextLine}

THEIR EMAIL: "${context.incomingMessage}"

RESPONSE STRATEGY (HOOK-RELATE-BRIDGE-ASK):
1. Acknowledge their response directly
2. Show you understand their situation (${leadContext.situationContext})
3. Remind them of the two options and how a 10-minute walkthrough provides clarity
4. Move toward scheduling the property visit

Keep response under 150 words. Focus on "control" and "options". Goal: get a Yes/No/Maybe on a property visit.

${sharedRules}`;
    }
  } else if (touch === 1) {
    if (isPreforeclosure) {
      systemPrompt = `You are Jose Fernandez, a licensed NJ real estate agent from RE/MAX Homeland Realtors, reaching out to ${context.contactName} regarding public notices filed for ${propertyRef}.

CRITICAL MANDATE:
- LEAD WITH VALUE, HELPFUL INFORMATION, AND NJ HOMEOWNER RIGHTS.
- DO NOT ASK THEM TO SELL. DO NOT PITCH A CASH OFFER. DO NOT ASK FOR A WALKTHROUGH.
- The selling conversation will come later if they ever decide staying is not feasible. The immediate goal is to provide genuine guidance as a local advocate.

KEY CONTEXT & NJ HOMEOWNER RIGHTS TO SHARE:
1. Public Notice Lag: Acknowledge that county public notices (Lis Pendens) are matter of public record, but they often lag weeks behind reality. If they've already resolved, reinstated, or paid off the balance (such as a second mortgage or junior lien), congratulate them and apologize for reaching out based on outdated records.
2. Options to Stay: Note that keeping the home is usually the first priority through loan reinstatement, forbearance, or a loan modification.
3. NJ Foreclosure Mediation: Inform them that the NJ Superior Court offers a free, court-sponsored Foreclosure Mediation Program to help homeowners negotiate directly with lenders.
4. Equity Protection: If staying isn't feasible down the road, emphasize that protecting their hard-earned equity is paramount, rather than letting it be wiped out at a sheriff sale.
5. Low-Pressure Resource: Offer to share a free NJ Homeowner Foreclosure Resource Guide or answer questions about court timelines.

TONE & STYLE:
- Empathetic, respectful, professional, and community-minded — NOT a wholesaler or opportunistic buyer.
- Keep it under 130 words (body only, no signature).
- No "Hi" or "Hello" — open with their name followed by a comma (e.g. "${context.contactName},").
- Subject Line: Helpful, non-alarmist, personal (e.g. "Resources for ${context.propertyAddress || 'your property'}" or "NJ homeowner options regarding ${context.propertyAddress || 'your property'}").

${sharedRules}`;
    } else {
      systemPrompt = `You are Jose Fernandez, a NJ real estate agent from RE/MAX Homeland Realtors, sending a cold outreach email to ${context.contactName} about their ${leadContext.displayType} property at ${propertyRef}.

GOAL: Get them to agree to a 10-minute property walkthrough so you can give them accurate numbers.

WHAT YOU KNOW:
- Lead type: ${leadContext.displayType} (${leadContext.situationContext})
- Property: ${propertyRef}
- ${hasPropertyData ? `Cash offer: $${cashOffer?.toLocaleString()} | Retail value: $${propertyData!.zestimate?.toLocaleString()}` : 'No valuation yet — offer to assess in person'}

FRAMEWORK (Hook-Relate-Bridge-Ask):
1. Hook: Open with something that shows you know their situation — don't be generic
2. Relate: ${leadContext.touch1Relate}
3. Bridge: Present the two options (cash offer vs retail listing) as giving them control and clarity
4. Ask: Request a 10-minute walkthrough — low commitment, no pressure

TONE & STYLE:
- Conversational but professional — write like a real person, not a template
- Vary your wording, sentence structure, and opening line — don't always start the same way
- Keep it under 120 words (body only, no signature)
- No "Hi" or "Hello" — open with their name followed by a comma, or lead with a statement

SUBJECT LINE: Write a short, specific subject (3-7 words) that feels personal to their property or situation. Vary it — don't always use "Clarity on [address]". Examples: address-based, question-based, outcome-based.

${sharedRules}`;
    }
  } else if (touch === 2) {
    if (isPreforeclosure) {
      systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending a SHORT follow-up email (touch 2 of 7) to ${context.contactName} regarding their property at ${propertyRef}.

Write a brief, casual 2-3 sentence follow-up. Acknowledge that they receive a lot of bank notices and mail right now. Ask if they had a chance to see your note about NJ foreclosure mediation and homeowner resources, or if they have any questions about the timeline. Keep it under 60 words.

Subject: something like "Quick note regarding ${context.propertyAddress || 'your property'}" or "Re: NJ homeowner resources"

${sharedRules}`;
    } else {
      systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending a SHORT follow-up email (touch 2 of 7) to ${context.contactName} who did not respond to your first email about their ${leadContext.displayType} property at ${propertyRef}.

Write a brief, casual 2-3 sentence follow-up. Just bump the previous email — don't repeat all the details. Acknowledge you know they're busy. Keep it under 60 words.

Subject: something like "Re: ${context.propertyAddress || 'Your Property'}" or "Quick follow-up"

${sharedRules}`;
    }
  } else if (touch === 3) {
    if (isPreforeclosure) {
      systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending touch 3 of 7 to ${context.contactName} about their property at ${propertyRef}.

This email focuses on EQUITY PROTECTION & FINANCIAL CLARITY.
Explain that whether they plan to stay in the home through loan modification or eventually transition, having an accurate picture of their real market value vs what is owed is vital. In New Jersey, letting a property go to auction without knowing the numbers can wipe out tens of thousands in accumulated equity. Offer to provide an equity assessment with zero obligation so they know where they stand. Keep it under 100 words.

Subject: something about equity protection or understanding their property numbers (e.g. "Protecting your equity at ${context.propertyAddress || 'your property'}")

${sharedRules}`;
    } else {
      systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending touch 3 of 7 to ${context.contactName} about their ${leadContext.displayType} property at ${propertyRef}.

This email leads with the financial decision they're facing. Mention the two options with numbers if available. Ask about their timeline — are they looking to move quickly or take their time? Keep it under 100 words.

${offerLines}

Subject: something about their options or timeline (e.g. "Your options for ${context.propertyAddress || 'the property'}")

${sharedRules}`;
    }
  } else if (touch === 4) {
    if (isPreforeclosure) {
      systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending touch 4 of 7 to ${context.contactName} about their property at ${propertyRef}.

This email takes an empathetic approach. Acknowledge that dealing with lender paperwork, notices, and uncertain timelines is deeply stressful. Remind them that NJ homeowners have statutory rights under the NJ Fair Foreclosure Act (including two 14-day Sheriff Sale adjournments by right and access to court mediation). Offer to be a confidential sounding board to help them sort through options. Keep it under 100 words.

Subject: something empathetic and low-pressure (e.g. "Here to help navigate options for ${context.propertyAddress || 'your property'}")

${sharedRules}`;
    } else {
      systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending touch 4 of 7 to ${context.contactName} about their ${leadContext.displayType} property at ${propertyRef}.

This email takes an emotional/empathy angle. Acknowledge that ${leadContext.touch4Empathy}. Focus on reducing stress and giving them control — not just the money. Offer to be a resource even if they're not ready to decide. Keep it under 100 words.

Subject: something empathetic and low-pressure

${sharedRules}`;
    }
  } else if (touch === 5) {
    if (isPreforeclosure) {
      systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending touch 5 of 7 to ${context.contactName} about their property at ${propertyRef}.

Lead with social proof and community experience — you have helped many NJ families navigate foreclosure notices, explore court-sponsored mediation, or protect their remaining equity so they didn't walk away empty-handed. Ask if they'd like to spend 5-10 minutes on a quick call to get clarity on their timeline and options. Keep it under 100 words.

Subject: something referencing helping local NJ homeowners (e.g. "How we've helped NJ homeowners in similar situations")

${sharedRules}`;
    } else {
      systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending touch 5 of 7 to ${context.contactName} about their ${leadContext.displayType} property at ${propertyRef}.

Lead with social proof — you've helped many NJ families ${leadContext.touch5SocialProof}. Briefly mention the two options${hasPropertyData ? ` ($${cashOffer?.toLocaleString()} cash or $${propertyData!.zestimate?.toLocaleString()} retail)` : ''}. Ask if they have 10 minutes for a quick call or walkthrough. Keep it under 100 words.

Subject: something referencing helping other families or experience

${sharedRules}`;
    }
  } else if (touch === 6) {
    if (isPreforeclosure) {
      systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending touch 6 of 7 to ${context.contactName} about their property at ${propertyRef}.

Create gentle, constructive timeline awareness — ${leadContext.touch6Urgency}. Emphasize that taking action early gives them the broadest set of options (loan workouts, court mediation, or protecting equity). Remind them you are here with no pressure or obligation. Keep it under 100 words.

Subject: something around timing and protecting options (e.g. "Keeping your options open for ${context.propertyAddress || 'your property'}")

${sharedRules}`;
    } else {
      systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending touch 6 of 7 to ${context.contactName} about their ${leadContext.displayType} property at ${propertyRef}.

Create gentle urgency — ${leadContext.touch6Urgency}. This isn't pressure — it's giving them the full picture so they can make the best decision. Remind them the 10-minute walkthrough is no obligation. Keep it under 100 words.

Subject: something around timing or "before it's too late"

${sharedRules}`;
    }
  } else if (touch === 7) {
    // Touch 7 — break-up / transition email
    systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending a "break-up" email (touch 7) to ${context.contactName} about their ${leadContext.displayType} property at ${propertyRef}.

Keep it very short — under 60 words. Be respectful and leave the door open permanently. Say you'll step back for now, but if they ever want to explore their options or need guidance on NJ property rights, you're a phone call away. No pressure, no pitch.

Subject: something like "Last note from Jose" or "Stepping back"

${sharedRules}`;
  } else {
    // Touch 8+ — monthly nurture email (sent every 30 days)
    systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending a gentle monthly check-in email (long-term nurture touch ${touch}) to ${context.contactName} regarding their ${leadContext.displayType} property at ${propertyRef}.

FRAMEWORK & TONE:
- This is a soft, long-term monthly check-in (30 days since your last note).
- Be extremely respectful, warm, and conversational — no hard pitch or aggressive urgency.
- Acknowledge that ${leadContext.monthlyNurtureAngle}.
- Ask if their plans for ${propertyRef} have evolved or if they have any questions about cash offer vs retail options.
- Keep it under 75 words (body only, no signature).

Subject: A soft, warm subject line (e.g. "Checking in on ${context.propertyAddress || 'the property'}" or "Quick update from Jose")

${sharedRules}`;
  }

  try {
    console.log('🤖 [EMAIL_AI] Calling OpenAI with context:', {
      contactName: context.contactName,
      propertyAddress: context.propertyAddress,
      leadType: context.leadType,
      hasZestimate: !!propertyData?.zestimate,
      touch,
    });

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: isReply
              ? context.incomingMessage
              : 'Generate the outreach email.',
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );

    console.log(
      '🤖 [EMAIL_AI] OpenAI raw response:',
      response.data.choices[0]?.message?.content,
    );

    const result = JSON.parse(
      response.data.choices[0]?.message?.content || '{}',
    );

    console.log('🤖 [EMAIL_AI] Parsed result:', result);

    if (!result.body || !result.subject) {
      console.error(
        '❌ [EMAIL_AI] OpenAI returned incomplete response. Full result:',
        JSON.stringify(result),
      );
      throw new Error(
        `OpenAI failed to generate email: missing ${!result.body ? 'body' : 'subject'}`
      );
    }

    // Convert plain text to HTML with proper formatting
    let htmlBody = result.body;

    // Convert line breaks to paragraphs
    htmlBody = htmlBody
      .split('\n\n') // Split on double line breaks (paragraphs)
      .map((para: string) => {
        // Handle bullet points
        if (para.includes('•') || para.includes('-')) {
          const lines = para.split('\n');
          const bullets = lines
            .filter(
              (line) =>
                line.trim().startsWith('•') || line.trim().startsWith('-'),
            )
            .map((line) => `<li>${line.replace(/^[•\-]\s*/, '').trim()}</li>`)
            .join('');
          const nonBullets = lines
            .filter(
              (line) =>
                !line.trim().startsWith('•') && !line.trim().startsWith('-'),
            )
            .join('<br>');
          return nonBullets
            ? `<p>${nonBullets}</p><ul>${bullets}</ul>`
            : `<ul>${bullets}</ul>`;
        }
        // Regular paragraph
        return `<p>${para.replace(/\n/g, '<br>')}</p>`;
      })
      .join('');

    // Append HTML signature if provided, otherwise use default
    const signature =
      context.emailSignature ||
      `
      <p>
        Jose Fernandez<br>
        RE/MAX Homeland Realtors<br>
        (732) 810-0182
      </p>
    `;

    htmlBody += `<br>${signature}`;

    return {
      subject:
        result.subject || `Re: ${context.propertyAddress || 'Your Property'}`,
      body: htmlBody,
    };
  } catch (error: any) {
    console.error('❌ OpenAI API error:', error);
    console.error('❌ Full error details:', JSON.stringify(error, null, 2));
    throw new Error(`AI email generation failed: ${error.message}`);
  }
}

// Check if contact has AI enabled
function isAIEnabled(contact: any, explicitLeadType?: string, toEmail?: string): boolean {
  const hasEmail = Boolean(contact?.email || toEmail);
  const leadType =
    explicitLeadType ||
    contact?.customFields?.find(
      (f: any) => f.id === 'oaf4wCuM3Ub9eGpiddrO',
    )?.value;

  const normType = (leadType || '').toUpperCase().replace(/[_\s-]+/g, ' ').trim();
  const validLeadTypes = new Set([
    'PROBATE',
    'PREFORECLOSURE',
    'PRE FORECLOSURE',
    'FSBO',
    'TAX DELINQUENT',
    'DRIVING FOR DOLLARS',
    'VACANT',
    'OTHER',
    'SELL AS IS',
    'GENERAL INQUIRY',
  ]);
  const hasValidLeadType = validLeadTypes.has(normType);

  // For email outreach, we only need email and valid lead type
  // "Direct Mail" contacts can still receive AI emails
  return hasEmail && hasValidLeadType;
}

// Update AI state in GHL
async function updateAIState(contactId: string, newState: string, accessToken: string) {
  try {
    await ghlUpdateContact(accessToken, contactId, {
      customFields: [{ id: '1NxQW2kKMVgozjSUuu7s', value: newState }]
    });
  } catch (error) {
    console.error('Failed to update AI state:', error);
  }
}

function shouldHandoffToHuman(message: string): boolean {
  const handoffKeywords = [
    'speak to someone',
    'talk to a person',
    'human',
    'agent',
    'ready to sell',
    'schedule',
    'appointment',
    'call me',
    'interested',
    'yes i want',
    'how much',
    'what can you offer',
  ];

  return handoffKeywords.some((keyword) =>
    message.toLowerCase().includes(keyword),
  );
}

// Main email conversation handler
export async function generateEmailAIResponse(
  context: EmailConversationContext,
): Promise<{ subject: string; body: string }> {
  try {
    // Require accessToken for non-test mode
    if (!context.testMode && !context.accessToken) {
      throw new Error('accessToken is required for production mode');
    }

    // Check if AI is enabled for this contact
    if (!context.testMode && !isAIEnabled(context.contact, context.leadType, context.toEmail)) {
      console.log(`❌ AI disabled for contact ${context.contactId} (leadType: "${context.leadType}")`);
      throw new Error('AI is not enabled for this contact');
    }

    // Update AI state to running
    if (!context.testMode && context.accessToken) {
      await updateAIState(context.contactId, 'running', context.accessToken);
    }

    // Check for wrong person / authority mismatch / terminal objections
    const detectedOutcome = detectCallOutcomeFromMessage(context.incomingMessage);
    if (detectedOutcome === 'Wrong Number / Disconnected / Invalid Number') {
      if (!context.testMode && context.accessToken) {
        await updateAIState(context.contactId, 'stopped', context.accessToken);
        await ghlAddTags(context.accessToken, context.contactId, ['not_for_sale', 'conversation_ended', 'data_error:wrong_contact']);
      }

      const wrongContactEmail = {
        subject: `Re: ${context.propertyAddress || 'Your Property'}`,
        body: `${context.contactName},\n\nMy apologies for the confusion! I've updated our records so you won't receive any further emails regarding this property.\n\nHave a great day!\n\nJose Fernandez\nRE/MAX Homeland Realtors\n(732) 810-0182`,
      };

      if (context.accessToken) {
        await sendGHLEmail(
          context.conversationId,
          wrongContactEmail.subject,
          wrongContactEmail.body,
          context.accessToken,
          context.testMode,
          context.fromEmail,
          context.contactId,
          context.toEmail,
        );
      }

      return wrongContactEmail;
    }

    if (detectedOutcome === 'Not Interested' || detectedOutcome === 'Sold Already' || detectedOutcome === 'Listed With Realtor' || detectedOutcome === 'DNC') {
      if (!context.testMode && context.accessToken) {
        await updateAIState(context.contactId, 'stopped', context.accessToken);
        await ghlAddTags(context.accessToken, context.contactId, ['not_for_sale', 'conversation_ended']);
      }

      const msgLower = (context.incomingMessage || '').toLowerCase();
      const isPaidOrSecondMortgage =
        msgLower.includes('paid') ||
        msgLower.includes('second mortgage') ||
        msgLower.includes('2nd mortgage');

      const stopBody = isPaidOrSecondMortgage
        ? `${context.contactName},\n\nThank you for letting me know, and congratulations on having that resolved! County public notices often lag behind reality by weeks, and I apologize for reaching out based on outdated records. I've updated our records so you won't receive any further emails regarding this property.\n\nWishing you all the best!\n\nJose Fernandez\nRE/MAX Homeland Realtors\n(732) 810-0182`
        : `${context.contactName},\n\nThank you for letting me know. I've updated our records so you won't receive any further emails. If you ever have questions or want to explore options in the future, feel free to reach out. Wishing you all the best!\n\nJose Fernandez\nRE/MAX Homeland Realtors\n(732) 810-0182`;

      const stopEmail = {
        subject: `Re: ${context.propertyAddress || 'Your Property'}`,
        body: stopBody,
      };

      if (context.accessToken) {
        await sendGHLEmail(
          context.conversationId,
          stopEmail.subject,
          stopEmail.body,
          context.accessToken,
          context.testMode,
          context.fromEmail,
          context.contactId,
          context.toEmail,
        );
      }

      return stopEmail;
    }

    // Check if human handoff is needed
    if (shouldHandoffToHuman(context.incomingMessage)) {
      if (!context.testMode && context.accessToken) {
        await updateAIState(context.contactId, 'handoff', context.accessToken);

        // Tag contact for human follow-up
        await ghlAddTags(context.accessToken, context.contactId, ['Ready-For-Human-Contact']);
      }

      const handoffEmail = {
        subject: 'Re: Your Property Options',
        body: `${context.contactName},\n\nGreat! I'll have one of our property specialists reach out to you within the next few hours to discuss your options in detail.\n\nThanks for your interest!\n\nJose Fernandez\nRE/MAX Homeland Realtors\n(732) 810-0182`,
      };

      await sendGHLEmail(
        context.conversationId,
        handoffEmail.subject,
        handoffEmail.body,
        context.accessToken || '',
        context.testMode,
        context.fromEmail,
        context.contactId,
        context.toEmail,
      );

      return handoffEmail;
    }

    // Get property analysis for context
    let propertyData: PropertyAnalysis | null = null;

    // Use provided zestimate if available, otherwise fetch from API
    if (context.zestimate) {
      propertyData = { zestimate: context.zestimate };
    } else if (
      context.propertyAddress &&
      context.propertyCity &&
      context.propertyState
    ) {
      propertyData = await getPropertyAnalysis(
        context.propertyAddress,
        context.propertyCity,
        context.propertyState,
        context.propertyZip || '',
      );
    }

    // Generate AI email response
    const emailResponse = await generateEmailResponse(
      context,
      propertyData || undefined,
    );

    // Send response to GHL
    await sendGHLEmail(
      context.conversationId,
      emailResponse.subject,
      emailResponse.body,
      context.accessToken || '',
      context.testMode,
      context.fromEmail,
      context.contactId,
      context.toEmail,
    );

    return emailResponse;
  } catch (error) {
    console.error('Email conversation handler error:', error);

    // CRITICAL: For automated cold outreach touches (touches 1-7), NEVER send a generic
    // "Thanks for your message" fallback if AI fails! The contact never messaged us.
    // Re-throw so the send route fails, the queue agent releases the lock, and it retries later.
    if (context.incomingMessage === 'initial_outreach') {
      throw error;
    }

    const fallbackEmail = {
      subject: 'Re: Your Property',
      body: `${context.contactName},\n\nThanks for your message! I'll get back to you shortly.\n\nJose Fernandez\nRE/MAX Homeland Realtors\n(732) 810-0182`,
    };

    if (context.accessToken) {
      await sendGHLEmail(
        context.conversationId,
        fallbackEmail.subject,
        fallbackEmail.body,
        context.accessToken,
        context.testMode,
        context.fromEmail,
        context.contactId,
        context.toEmail,
      );
    }

    return fallbackEmail;
  }
}
