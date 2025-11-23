import { parse } from 'csv-parse';
import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';
import { validateAddressWithGoogle } from '@/app/utils/google.server';
import {
  skipTraceProbateLead,
  skipTracePreForeClosureLead,
} from '@/app/utils/batchData.server';
import { type Schema } from '@/amplify/data/resource';
import { type LeadToSkip } from '@/app/types/batchdata/leadToSkip';
import { detectLeadType } from '@/app/lib/detectLeadType'; // Your client-side util is fine to use here

// Define the two types of CSV rows (matches your files)
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

/**
 * Processes an uploaded CSV file as a stream.
 * This function runs in the background.
 */
export async function processCsvOnServer(file: File, userId: string) {
  console.log(`Starting CSV processing for user: ${userId}`);

  // 1. Create the parser stream
  // We pipe the file's web stream into the CSV parser
  const parser = (file.stream() as any)
    .pipeThrough(new TextDecoderStream())
    .pipe(
      parse({
        columns: true, // Use headers
        trim: true,
        skip_empty_lines: true,
      })
    );

  let leadType: 'probate' | 'preforeclosure' | 'unknown' = 'unknown';

  // 2. Use the Async Iterator to read row-by-row
  for await (const row of parser) {
    const lead = row as LeadRow;
    let leadId: string | null = null;
    let googleValidationPayload: any = null;
    let batchDataPayload: any = null;

    try {
      // 3. Detect lead type from the *first* row
      if (leadType === 'unknown') {
        leadType = detectLeadType(row);
        if (leadType === 'unknown') {
          throw new Error('Could not detect lead type from CSV headers.');
        }
      }

      // 5. Validate the property address
      const propertyAddress = `${lead.ownerAddress}, ${lead.ownerCity}, ${lead.ownerState} ${lead.ownerZip}`;
      const validation = await validateAddressWithGoogle(propertyAddress);
      googleValidationPayload = validation;
      if (!validation.success || validation.isPartialMatch) {
        throw new Error('Google address validation failed.');
      }

      // 4. Create the base Lead record in the DB
      const probateLead = lead as ProbateLeadRow;
      const { data: newLead, errors: createErrors } =
        await cookiesClient.models.Lead.create({
          type: leadType,
          ownerFirstName: lead.ownerFirstName,
          ownerLastName: lead.ownerLastName,
          ownerAddress: lead.ownerAddress,
          ownerCity: lead.ownerCity,
          ownerState: lead.ownerState,
          ownerZip: lead.ownerZip,
          adminFirstName: probateLead.adminFirstName,
          adminLastName: probateLead.adminLastName,
          adminAddress: probateLead.adminAddress,
          adminCity: probateLead.adminCity,
          adminState: probateLead.adminState,
          adminZip: probateLead.adminZip,
        });

      if (createErrors) throw new Error(createErrors[0].message);

      // 6. Run Skip Trace / Lookup
      let result;
      let leadsToSkip: LeadToSkip[] = [];

      if (leadType === 'probate') {
        if (!probateLead.adminAddress || !probateLead.adminFirstName) {
          throw new Error('Missing Admin info for Probate lead.');
        }
        const leadToSkip = {
          name: {
            first: probateLead.adminFirstName!,
            last: probateLead.adminLastName!,
          },
          propertyAddress: {
            street: probateLead.adminAddress!,
            city: probateLead.adminCity!,
            state: probateLead.adminState!,
            zip: probateLead.adminZip!,
          },
        };

        leadsToSkip.push(leadToSkip);
        result = await skipTraceProbateLead(leadsToSkip);
      } else {
        // ... (pre-foreclosure logic) ...
        const leadToSkip = {
          name: { first: lead.ownerFirstName, last: lead.ownerLastName },
          propertyAddress: {
            street: lead.ownerAddress,
            city: lead.ownerCity,
            state: lead.ownerState,
            zip: lead.ownerZip,
          },
        };
        leadsToSkip.push(leadToSkip);
        result = await skipTracePreForeClosureLead(leadsToSkip);
      }

      if (!result) throw new Error('BatchData returned no data.');
      batchDataPayload = result;

      // 7. Update Lead, create Contact and Enrichment
      // (This logic can be copied from the 'process-leads' route
      // we built in the previous step)

      console.log(`Successfully processed: ${lead.ownerAddress}`);
    } catch (processError: any) {
      console.error(
        `Failed to process row for ${lead.ownerAddress}:`,
        processError.message
      );

      // 8. Create enrichment record for the error
      if (leadId) {
        // Only if the lead was created
        await cookiesClient.models.Enrichment.create({
          leadId: leadId,
          source: 'process:error',
          statusText: 'FAILED',
          payload: { error: processError.message },
          owner: userId, // Manually set owner
        });
      }
    }
  } // end for await...of

  console.log(`Finished processing CSV for user: ${userId}`);
}
