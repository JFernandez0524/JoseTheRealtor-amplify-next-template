import axios from 'axios';

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
    ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://leads.josetherealtor.com'}/unsubscribe?contact=${contactId}`
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

    // Use contact-based endpoint if contactId provided
    const endpoint = contactId
      ? `https://services.leadconnectorhq.com/conversations/messages`
      : `https://services.leadconnectorhq.com/conversations/${conversationId}/messages`;

    if (contactId) {
      messagePayload.contactId = contactId;
    }

    await axios.post(endpoint, messagePayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
        Accept: 'application/json',
      },
    });
    console.log('✅ Email sent successfully to GHL');
  } catch (error: any) {
    console.error(
      '❌ Failed to send GHL email:',
      error.response?.data || error.message,
    );
    throw error;
  }
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

  const situationContext =
    context.leadType === 'Probate'
      ? 'navigate the complexity and stress of settling estates'
      : 'avoid foreclosure and protect their equity';

  const propertyRef = hasAddress
    ? `${context.propertyAddress} in ${context.propertyCity}`
    : 'your property';

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

  if (isReply) {
    systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors responding to ${context.contactName}'s email about their ${context.leadType?.toLowerCase()} situation.

CONTEXT:
- Property: ${propertyRef}
${hasPropertyData ? `- Cash Offer: $${cashOffer?.toLocaleString()}\n- Retail Value: $${propertyData!.zestimate?.toLocaleString()}` : '- No valuation data yet'}

THEIR EMAIL: "${context.incomingMessage}"

RESPONSE STRATEGY (HOOK-RELATE-BRIDGE-ASK):
1. Acknowledge their response directly
2. Show you understand their situation
3. Remind them of the two options and how a 10-minute walkthrough provides clarity
4. Move toward scheduling the property visit

Keep response under 150 words. Focus on "control" and "options". Goal: get a Yes/No/Maybe on a property visit.

${sharedRules}`;
  } else if (touch === 1) {
    systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending a FIRST-TIME email to ${context.contactName} about their ${context.leadType?.toLowerCase()} situation.

Write a concise outreach email using the Hook-Relate-Bridge-Ask structure:

${context.contactName},

I help NJ families ${situationContext}. I saw the public notice regarding the property at ${propertyRef}.

I can provide you with two clear options:

${offerLines}

Having both options gives you complete control over your next move and removes the uncertainty from this process.

I just need 10 minutes to see the property condition so I can give you accurate numbers for both routes.

Are you open to meeting with me to discuss your options?

Subject: "Clarity on ${context.propertyAddress || 'Your Property'}"

${sharedRules}`;
  } else if (touch === 2) {
    systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending a SHORT follow-up email (touch 2 of 7) to ${context.contactName} who did not respond to your first email about their ${context.leadType?.toLowerCase()} property at ${propertyRef}.

Write a brief, casual 2-3 sentence follow-up. Just bump the previous email — don't repeat all the details. Acknowledge you know they're busy. Keep it under 60 words.

Subject: something like "Re: ${context.propertyAddress || 'Your Property'}" or "Quick follow-up"

${sharedRules}`;
  } else if (touch === 3) {
    systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending touch 3 of 7 to ${context.contactName} about their ${context.leadType?.toLowerCase()} property at ${propertyRef}.

This email leads with the financial decision they're facing. Mention the two options with numbers if available. Ask about their timeline — are they looking to move quickly or take their time? Keep it under 100 words.

${offerLines}

Subject: something about their options or timeline (e.g. "Your options for ${context.propertyAddress || 'the property'}")

${sharedRules}`;
  } else if (touch === 4) {
    systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending touch 4 of 7 to ${context.contactName} about their ${context.leadType?.toLowerCase()} property at ${propertyRef}.

This email takes an emotional/empathy angle. Acknowledge that ${context.leadType === 'Probate' ? 'settling an estate is one of the hardest things a family goes through' : 'facing foreclosure is incredibly stressful'}. Focus on reducing stress and giving them control — not just the money. Offer to be a resource even if they're not ready to decide. Keep it under 100 words.

Subject: something empathetic and low-pressure

${sharedRules}`;
  } else if (touch === 5) {
    systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending touch 5 of 7 to ${context.contactName} about their ${context.leadType?.toLowerCase()} property at ${propertyRef}.

Lead with social proof — you've helped many NJ families in the exact same ${context.leadType?.toLowerCase()} situation get clarity and move forward. Briefly mention the two options${hasPropertyData ? ` ($${cashOffer?.toLocaleString()} cash or $${propertyData!.zestimate?.toLocaleString()} retail)` : ''}. Ask if they have 10 minutes for a quick call or walkthrough. Keep it under 100 words.

Subject: something referencing helping other families or experience

${sharedRules}`;
  } else if (touch === 6) {
    systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending touch 6 of 7 to ${context.contactName} about their ${context.leadType?.toLowerCase()} property at ${propertyRef}.

Create gentle urgency — ${context.leadType === 'Probate' ? 'probate estates have legal timelines and delays can reduce the estate value' : 'foreclosure timelines move fast and acting early gives far more options'}. This isn't pressure — it's giving them the full picture so they can make the best decision. Remind them the 10-minute walkthrough is no obligation. Keep it under 100 words.

Subject: something around timing or "before it's too late"

${sharedRules}`;
  } else {
    // Touch 7+ — break-up email
    systemPrompt = `You are Jose Fernandez from RE/MAX Homeland Realtors sending a final "break-up" email (touch 7) to ${context.contactName} about their ${context.leadType?.toLowerCase()} property at ${propertyRef}.

This is the last email. Keep it very short — under 60 words. Be respectful and leave the door open permanently. Say you won't reach out again but if they ever want to explore their options, you're a phone call away. No pressure, no pitch.

Subject: something like "Last note from Jose" or "Stepping back"

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
function isAIEnabled(contact: any): boolean {
  const hasEmail = contact?.email;
  const leadType = contact?.customFields?.find(
    (f: any) => f.id === 'oaf4wCuM3Ub9eGpiddrO',
  )?.value;

  const hasValidLeadType = [
    'Probate',
    'PREFORECLOSURE',
    'Preforeclosure',
  ].includes(leadType);

  // For email outreach, we only need email and valid lead type
  // "Direct Mail" contacts can still receive AI emails
  return hasEmail && hasValidLeadType;
}

// Update AI state in GHL
async function updateAIState(
  contactId: string,
  newState: string,
  accessToken: string,
) {
  try {
    await axios.put(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        customFields: [{ id: '1NxQW2kKMVgozjSUuu7s', value: newState }],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Version: '2021-07-28',
          Accept: 'application/json',
        },
      },
    );
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
    if (!context.testMode && !isAIEnabled(context.contact)) {
      console.log(`❌ AI disabled for contact ${context.contactId}`);
      throw new Error('AI is not enabled for this contact');
    }

    // Update AI state to running
    if (!context.testMode && context.accessToken) {
      await updateAIState(context.contactId, 'running', context.accessToken);
    }

    // Check if human handoff is needed
    if (shouldHandoffToHuman(context.incomingMessage)) {
      if (!context.testMode && context.accessToken) {
        await updateAIState(context.contactId, 'handoff', context.accessToken);

        // Tag contact for human follow-up
        await axios.post(
          `https://services.leadconnectorhq.com/contacts/${context.contactId}/tags`,
          { tags: ['Ready-For-Human-Contact'] },
          {
            headers: {
              Authorization: `Bearer ${context.accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        );
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
