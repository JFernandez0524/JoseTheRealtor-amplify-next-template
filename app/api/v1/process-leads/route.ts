import { NextResponse } from 'next/server';
import {
  AuthGetCurrentUserServer,
  cookiesClient,
} from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { validateAddressWithGoogle } from '@/app/utils/google.server';
import {
  skipTraceProbateLead,
  skipTracePreForeClosureLead,
} from '@/app/utils/batchData.server';
import { type Schema } from '@/amplify/data/resource'; // Adjust path as needed
import { LeadToSkip } from '@/app/types/batchdata/leadToSkip';

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
};

type PreForeclosureLeadRow = {
  ownerFirstName: string;
  ownerLastName: string;
  ownerAddress: string;
  ownerCity: string;
  ownerState: string;
  ownerZip: string;
};

// A "union" type to represent either shape
type LeadRow = ProbateLeadRow | PreForeclosureLeadRow;

export async function POST(request: Request) {
  const user = await AuthGetCurrentUserServer();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const {
      leadsBatch,
      leadType,
    }: { leadsBatch: LeadRow[]; leadType: 'PROBATE' | 'PREFORECLOSURE' } =
      await request.json();

     
    if (!leadsBatch || !leadType) {
      return NextResponse.json(
        { error: 'leadsBatch and leadType are required' },
        { status: 400 }
      );
    }
    
    const requestsArray: LeadToSkip[] = [];
    const validationPromises = [];

    let processedCount = 0;

    for (const lead of leadsBatch) {
      let googleValidationPayload: any = null;
      let batchDataPayload: any = null;
      let leadId: string | null = null;

      // Determine the property address from the CSV row
      const propertyAddress = `${lead.ownerAddress}, ${lead.ownerCity}, ${lead.ownerState} ${lead.ownerZip}`;
      let standardizedAddress: any = null;
      let validatedAddressString = propertyAddress;

      try {
        // --- 1. VALIDATION STEP ---
        const validation = await validateAddressWithGoogle(propertyAddress);
        googleValidationPayload = validation;

        if (!validation.success || validation.isPartialMatch) {
          throw new Error('Google address validation failed.');
        }

        validatedAddressString = validation.formattedAddress;
        //get lat and longitude from googleValidationPayload
        const lat = googleValidationPayload?.lat;
        const lng = googleValidationPayload?.lng;

        let nameToSkip, addressToSkip, result;

        // --- 2. SKIP TRACE / LOOKUP STEP ---
        if (leadType === 'PROBATE') {
          const probateLead = lead as ProbateLeadRow;

          const leadToSkip = {
             // For probate, we skip trace the EXECUTOR's name
          name : {
            first: probateLead.adminFirstName!,
            last: probateLead.adminLastName!,
          },          // ...at the ADMIN property address
          propertyAddress: {
            street: probateLead.adminAddress!,
            city: probateLead.adminCity!,
            state: probateLead.adminState!,
            zip: probateLead.adminZip!,
          }
          }
         

          result = await skipTracePropertyLead(leadToSkip);
        } else {
          // For pre-foreclosure, we skip trace the OWNER
          nameToSkip = {
            firstName: lead.ownerFirstName,
            lastName: lead.ownerLastName,
          };
          addressToSkip = {
            street: lead.ownerAddress,
            city: lead.ownerCity,
            state: lead.ownerState,
            zip: lead.ownerZip,
          };

          result = await lookupPreForeclosureProperty(
            nameToSkip,
            addressToSkip
          );
        }

        const { contact, propertyDetails, rawPayload } = result;
        standardizedAddress = result.standardizedAddress;
        batchDataPayload = rawPayload;

      //   // --- 3. SAVE TO DATABASE ---
      //   const probateLead = lead as ProbateLeadRow; // Cast to get admin fields
      //   const newLead = await cookiesClient.models.Lead.create({
      //     type: leadType,
      //     // DB gets the *original* owner info from the CSV
      //     ownerFirstName: lead.ownerFirstName,
      //     ownerLastName: lead.ownerLastName,
      //     ownerAddress: lead.ownerAddress,
      //     ownerCity: lead.ownerCity,
      //     ownerState: lead.ownerState,
      //     ownerZip: lead.ownerZip,
      //     standardizedAddress: standardizedAddress, // Save the standardized address
      //     adminFirstName: probateLead.adminFirstName,
      //     adminLastName: probateLead.adminLastName,
      //     adminAddress: probateLead.adminAddress,
      //     adminCity: probateLead.adminCity,
      //     adminState: probateLead.adminState,
      //     adminZip: probateLead.adminZip,
      //   });

    

      //   // Create the Contact record (this is the skip-traced person)
      //   await cookiesClient.models.Contact.create({
      //     leadId: leadId,
      //     role: leadType === 'PROBATE' ? 'executor' : 'owner',
      //     firstName: contact.firstName,
      //     lastName: contact.lastName,
      //     emails: contact.emails,
      //     phones: contact.phones,
      //     mailingAddress: contact.mailingAddress,
      //   });

      //   // Create the Enrichment record
      //   await cookiesClient.models.Enrichment.create({
      //     leadId: leadId,
      //     source:
      //       leadType === 'PROBATE' ? 'batchdata:skiptrace' : 'batchdata:lookup',
      //     statusText: 'COMPLETED',
      //     payload: batchDataPayload,
      //   });
      //   processedCount++;
      // } catch (processError: any) {
      //   console.error(`Failed to process ${lead}:`, processError.message);

      //   // If the lead was created but processing failed, create enrichment
      //   if (leadId) {
      //     await cookiesClient.models.Enrichment.create({
      //       leadId: leadId,
      //       source: 'process:error',
      //       statusText: 'FAILED',
      //       payload: {
      //         error: processError.message,
      //         google: googleValidationPayload,
      //       },
      //     });
      //   }
      // }

      // // Create Google Validation Enrichment (always)
      // if (leadId && googleValidationPayload) {
      //   await cookiesClient.models.Enrichment.create({
      //     leadId: leadId,
      //     source: 'google:address-validation',
      //     statusText: googleValidationPayload.success ? 'SUCCESS' : 'FAILED',
      //     payload: googleValidationPayload,
      //   });
      // }
    // } // end for loop

    return NextResponse.json({
      success: true,
      processed: processedCount,
      failed: leadsBatch.length - processedCount,
    });
  } catch (error: any) {
    console.error('Error processing batch:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
  
