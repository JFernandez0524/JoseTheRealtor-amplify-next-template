import { NextResponse } from 'next/server';
import {
  AuthGetCurrentUserServer,
  cookiesClient,
} from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { validateAddressWithGoogle } from '@/app/utils/google.server';
// 1. Import the correct functions from your library
import {
  skipTracePropertyLead,
  lookupPreForeclosureProperty,
} from '@/app/utils/batchdata.server';
import { type Schema } from '@/amplify/data/resource';
import { type Requests } from '@/app/types/batchdata/requests'; // Use your strict type

// Define the two types of CSV rows we can receive
type ProbateLeadRow = {
  ownerFirstName: string;
  ownerLastName: string;
  ownerAddress: string;
  ownerCity: string;
  ownerState: string;
  ownerZip: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminAddress?: string;
  adminCity?: string;
  adminState?: string;
  adminZip?: string;
  caseNumber?: string;
};

type PreForeclosureLeadRow = {
  ownerFirstName: string;
  ownerLastName: string;
  ownerAddress: string;
  ownerCity: string;
  ownerState: string;
  ownerZip: string;
  caseNumber?: string;
};

type LeadRow = ProbateLeadRow | PreForeclosureLeadRow;

export async function POST(request: Request) {
  const user = await AuthGetCurrentUserServer();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { leadsBatch, leadType } = await request.json();

    if (!leadsBatch || !leadType) {
      return NextResponse.json(
        { error: 'leadsBatch and leadType are required' },
        { status: 400 }
      );
    }

    let processedCount = 0;
    let failedLeads: any[] = [];

    for (const lead of leadsBatch as LeadRow[]) {
      let googleValidationPayload: any = null;
      let batchDataPayload: any = null;
      let leadId: string | null = null;

      const probateLead = lead as ProbateLeadRow;
      // Determine property address for validation
      const propertyAddress = `${lead.ownerAddress}, ${lead.ownerCity}, ${lead.ownerState} ${lead.ownerZip}`;

      try {
        // --- 1. VALIDATION STEP ---
        const validation = await validateAddressWithGoogle(propertyAddress);
        googleValidationPayload = validation;

        if (!validation.success || validation.isPartialMatch) {
          throw new Error('Google address validation failed.');
        }

        // --- 2. SKIP TRACE / LOOKUP STEP ---
        let result;
        let leadToSkip: Requests; // Use your strict type

        if (leadType === 'PROBATE') {
          // Validate admin data
          if (!probateLead.adminAddress || !probateLead.adminFirstName) {
            throw new Error('Missing Admin/Executor info for Probate lead.');
          }

          leadToSkip = {
            name: {
              first: probateLead.adminFirstName, // Type assertion not needed if validated
              last: probateLead.adminLastName || '',
            },
            propertyAddress: {
              street: probateLead.adminAddress,
              city: probateLead.adminCity || '',
              state: probateLead.adminState || '',
              zip: probateLead.adminZip || '',
            },
          };

          // Call the SINGLE function (since we are in a loop)
          result = await skipTracePropertyLead(leadToSkip);
        } else {
          // Pre-foreclosure logic
          if (!lead.ownerFirstName) {
            throw new Error('Missing Owner name for Pre-Foreclosure lead.');
          }

          leadToSkip = {
            name: {
              first: lead.ownerFirstName,
              last: lead.ownerLastName || '',
            },
            propertyAddress: {
              street: lead.ownerAddress,
              city: lead.ownerCity,
              state: lead.ownerState,
              zip: lead.ownerZip,
            },
          };

          // Call the SINGLE function
          result = await lookupPreForeclosureProperty(leadToSkip);
        }

        if (!result) throw new Error('BatchData returned no data.');

        const { contact, propertyDetails, rawPayload } = result;
        batchDataPayload = rawPayload;

        // --- 3. SAVE TO DATABASE ---
        const leadInput: Schema['Lead']['type'] = {
          type: leadType,
          firstName: lead.ownerFirstName,
          lastName: lead.ownerLastName,

          // Use Google validated address
          address: validation.components.street,
          city: validation.components.city,
          state: validation.components.state,
          zip: validation.components.zip,
          standardizedAddress: validation.components,

          // Save coordinates
          latitude: validation.location.lat,
          longitude: validation.location.lng,

          // CSV info
          executorFirstName: probateLead.adminFirstName,
          executorLastName: probateLead.adminLastName,
          mailingAddress: probateLead.adminAddress,
          mailingCity: probateLead.adminCity,
          mailingState: probateLead.adminState,
          mailingZip: probateLead.adminZip,
          caseNumber: lead.caseNumber,

          // BatchData info
          preforeclosureNoticeDate: propertyDetails?.preforeclosureNoticeDate,
          preforeclosureAuctionDate: propertyDetails?.preforeclosureAuctionDate,
          estimatedValue: propertyDetails?.estimatedValue,
          estimatedValueYear: propertyDetails?.estimatedValueYear,
          yearBuilt: propertyDetails?.yearBuilt,
          squareFeet: propertyDetails?.squareFeet,
          bedrooms: propertyDetails?.bedrooms,
          baths: propertyDetails?.baths,

          skipTraceStatus: 'COMPLETED',
        };

        const { data: newLead, errors: createErrors } =
          await cookiesClient.models.Lead.create(leadInput);

        if (createErrors) {
          throw new Error(`Failed to create lead: ${createErrors[0].message}`);
        }
        leadId = newLead.id;

        // Create Contact
        await cookiesClient.models.Contact.create({
          leadId: leadId,
          role: leadType === 'PROBATE' ? 'executor' : 'owner',
          firstName: contact.firstName,
          lastName: contact.lastName,
          emails: contact.emails,
          phones: contact.phones,
          mailingAddress: contact.mailingAddress,
        });

        // Create BatchData Enrichment
        await cookiesClient.models.Enrichment.create({
          leadId: leadId,
          source:
            leadType === 'PROBATE' ? 'batchdata:skiptrace' : 'batchdata:lookup',
          statusText: 'COMPLETED',
          payload: batchDataPayload,
        });

        processedCount++;
      } catch (processError: any) {
        console.error(
          `Failed to process ${lead.ownerAddress}:`,
          processError.message
        );
        failedLeads.push({
          address: lead.ownerAddress,
          error: processError.message,
        });

        // If lead created but failed later, log error enrichment
        if (leadId) {
          await cookiesClient.models.Enrichment.create({
            leadId: leadId,
            source: 'process:error',
            statusText: 'FAILED',
            payload: {
              error: processError.message,
              google: googleValidationPayload,
            },
          });
        }
      }

      // Create Google Enrichment (Always)
      if (leadId && googleValidationPayload) {
        await cookiesClient.models.Enrichment.create({
          leadId: leadId,
          source: 'google:address-validation',
          statusText: googleValidationPayload.success ? 'SUCCESS' : 'FAILED',
          payload: googleValidationPayload,
        });
      }
    } // end for loop

    return NextResponse.json({
      success: true,
      processed: processedCount,
      failed: failedLeads.length,
      errors: failedLeads,
    });
  } catch (error: any) {
    console.error('Error processing batch:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
