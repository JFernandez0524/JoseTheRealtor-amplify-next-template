/**
 * TOGGLE MANUAL MODE API
 * 
 * Adds or removes "manual" tag to stop/start AI responses for a contact.
 * When manual mode is ON, AI will not respond to incoming messages.
 * 
 * Usage:
 * POST /api/v1/toggle-manual-mode
 * {
 *   "contactId": "abc123",
 *   "enable": true  // true = enable manual mode (stop AI), false = disable (resume AI)
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server';

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId, enable } = await request.json();

    if (!contactId) {
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 });
    }

    // Get user's GHL integration
    const { getValidGhlToken } = await import('@/amplify/functions/shared/ghlTokenManager');
    const tokenResult = await getValidGhlToken(user.userId);
    
    if (!tokenResult) {
      return NextResponse.json({ error: 'GHL integration not found' }, { status: 404 });
    }

    const { token } = tokenResult;

    // Get current contact tags
    const contactResponse = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Version': '2021-07-28'
        }
      }
    );

    if (!contactResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch contact' }, { status: 500 });
    }

    const contactData = await contactResponse.json();
    const currentTags = contactData.contact?.tags || [];

    // Add or remove manual tag
    let newTags = [...currentTags];
    const manualTag = 'manual';
    const hasManualTag = currentTags.includes(manualTag);

    if (enable && !hasManualTag) {
      newTags.push(manualTag);
    } else if (!enable && hasManualTag) {
      newTags = newTags.filter(tag => tag !== manualTag);
    }

    // Update contact tags
    const updateResponse = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tags: newTags
        })
      }
    );

    if (!updateResponse.ok) {
      return NextResponse.json({ error: 'Failed to update contact tags' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      manualMode: enable,
      contactId,
      tags: newTags,
      message: enable 
        ? 'Manual mode enabled - AI responses stopped' 
        : 'Manual mode disabled - AI responses resumed'
    });

  } catch (error) {
    console.error('Toggle manual mode error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
