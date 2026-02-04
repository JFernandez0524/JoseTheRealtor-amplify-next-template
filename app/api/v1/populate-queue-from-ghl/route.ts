import { NextRequest, NextResponse } from 'next/server';
import { AuthGetCurrentUserServer, cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';

interface GHLContact {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  additionalEmails?: string[];
  tags?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const user = await AuthGetCurrentUserServer();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🚀 Starting queue population from GHL...');

    // Get GHL integration for this user
    const { data: integrations } = await cookiesClient.models.GhlIntegration.list({
      filter: { userId: { eq: user.userId } }
    });

    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ error: 'GHL integration not found' }, { status: 400 });
    }

    const integration = integrations[0];
    if (!integration.accessToken) {
      return NextResponse.json({ error: 'GHL access token not found' }, { status: 400 });
    }

    // Check if token needs refresh (if expires soon)
    if (integration.expiresAt && new Date(integration.expiresAt) <= new Date(Date.now() + 5 * 60 * 1000)) {
      console.log('Token expires soon, attempting refresh...');
      // Token expires in 5 minutes or less, try to refresh
      try {
        const refreshResponse = await fetch('/api/v1/oauth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (refreshResponse.ok) {
          // Refetch integration after refresh
          const { data: refreshedIntegrations } = await cookiesClient.models.GhlIntegration.list({
            filter: { userId: { eq: user.userId } }
          });
          if (refreshedIntegrations && refreshedIntegrations.length > 0) {
            integration = refreshedIntegrations[0];
          }
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }
    }

    // Fetch ALL contacts with pagination using GHL contacts endpoint
    let allContacts: GHLContact[] = [];
    let startAfter: number | undefined;
    let startAfterId: string | undefined;
    let page = 1;

    console.log('📋 Fetching ALL GHL contacts with pagination...');

    while (true) {
      console.log(`📄 Fetching page ${page}...`);
      
      // Build URL with pagination parameters
      let url = `https://services.leadconnectorhq.com/contacts/?locationId=${integration.locationId}&limit=100`;
      if (startAfter && startAfterId) {
        url += `&startAfter=${startAfter}&startAfterId=${startAfterId}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${integration.accessToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('GHL API error:', response.status, response.statusText, errorText);
        return NextResponse.json({ 
          error: `GHL API error: ${response.status} ${response.statusText}`,
          details: errorText
        }, { status: 500 });
      }

      const data = await response.json();
      const contacts = data.contacts || [];
      
      console.log(`📊 Page ${page}: ${contacts.length} contacts`);
      
      if (contacts.length === 0) {
        break; // No more contacts
      }

      allContacts.push(...contacts);

      // Set pagination for next request
      if (contacts.length === 100) {
        const lastContact = contacts[contacts.length - 1];
        if (lastContact.startAfter && lastContact.startAfter.length >= 2) {
          startAfter = lastContact.startAfter[0];
          startAfterId = lastContact.startAfter[1];
          page++;
        } else {
          break; // No pagination info
        }
      } else {
        break; // Last page (less than 100 contacts)
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`📊 Total contacts fetched: ${allContacts.length}`);

    // Filter for contacts with "ai outreach" tag
    const aiOutreachContacts = allContacts.filter(contact => 
      contact.tags && contact.tags.includes('ai outreach')
    );

    console.log(`📊 Contacts with "ai outreach" tag: ${aiOutreachContacts.length}`);

    if (aiOutreachContacts.length === 0) {
      return NextResponse.json({ 
        message: 'No contacts found with "ai outreach" tag',
        totalContacts: allContacts.length,
        aiOutreachContacts: 0,
        queueEntriesAdded: 0
      });
    }

    // Add contacts to outreach queue
    let queueEntriesAdded = 0;
    const errors: string[] = [];

    for (const contact of aiOutreachContacts) {
      try {
        // Add SMS queue entry if phone exists
        if (contact.phone) {
          const smsEntry = {
            userId: user.userId,
            locationId: integration.locationId,
            contactId: contact.id,
            contactMethod: contact.phone,
            channel: 'SMS' as const,
            status: 'PENDING' as const,
            touchNumber: 1,
            nextTouchDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await cookiesClient.models.OutreachQueue.create(smsEntry);
          queueEntriesAdded++;
          console.log(`✅ Added SMS queue entry for ${contact.firstName} ${contact.lastName} (${contact.phone})`);
        }

        // Add EMAIL queue entries for all email addresses
        const emails = [contact.email, ...(contact.additionalEmails || [])].filter(Boolean);
        for (const email of emails) {
          const emailEntry = {
            userId: user.userId,
            locationId: integration.locationId,
            contactId: contact.id,
            contactMethod: email,
            channel: 'EMAIL' as const,
            status: 'PENDING' as const,
            touchNumber: 1,
            nextTouchDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await cookiesClient.models.OutreachQueue.create(emailEntry);
          queueEntriesAdded++;
          console.log(`✅ Added EMAIL queue entry for ${contact.firstName} ${contact.lastName} (${email})`);
        }

        // Rate limiting between contacts
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        const errorMsg = `Failed to add ${contact.firstName} ${contact.lastName} to queue: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    console.log(`🎉 Queue population complete!`);
    console.log(`📊 Total contacts: ${allContacts.length}`);
    console.log(`📊 AI outreach contacts: ${aiOutreachContacts.length}`);
    console.log(`📊 Queue entries added: ${queueEntriesAdded}`);
    console.log(`❌ Errors: ${errors.length}`);

    return NextResponse.json({
      message: 'Queue population completed',
      totalContacts: allContacts.length,
      aiOutreachContacts: aiOutreachContacts.length,
      queueEntriesAdded,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error populating queue:', error);
    return NextResponse.json({ 
      error: 'Failed to populate queue',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
