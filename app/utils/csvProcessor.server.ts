import { parse } from 'csv-parse';
import { Readable } from 'node:stream';
import { validateAddressWithGoogle } from './google.server';
import { createLead, type CreateLeadInput } from './aws/data/lead.server';

/**
 * Helper to map a raw CSV row to your Database Schema.
 * STRICT VERSION: Expects CSV headers to match DB schema fields exactly.
 */
function mapCsvRowToLeadInput(
  row: any,
  leadType: 'PROBATE' | 'PREFORECLOSURE',
  ownerId: string
): CreateLeadInput {
  // Helper to get trimmed value or undefined
  const val = (key: string) => (row[key] ? row[key].trim() : undefined);

  // Map DIRECTLY from schema field names
  const leadInput: CreateLeadInput = {
    owner: ownerId,
    type: leadType,

    // Generic Owner Info
    ownerFirstName: val('ownerFirstName'),
    ownerLastName: val('ownerLastName'),

    // Property Address
    ownerAddress: val('ownerAddress'),
    ownerCity: val('ownerCity'),
    ownerState: val('ownerState'),
    ownerZip: val('ownerZip'),

    // Probate Specific
    adminFirstName: val('adminFirstName'),
    adminLastName: val('executorLastName'),
    adminAddress: val('adminAddress'),
    adminCity: val('adminCity'),
    adminState: val('adminState'),
    adminZip: val('adminZip'),
  };

  return leadInput;
}

/**
 * Processes an uploaded CSV file stream.
 */
export async function processCsvOnServer(
  file: File,
  leadTypeString: string,
  ownerId: string
) {
  const leadType = leadTypeString.toUpperCase() as 'PROBATE' | 'PREFORECLOSURE';
  console.log(`Starting CSV processing for ${leadType} leads...`);

  const nodeStream = Readable.fromWeb(file.stream() as any);
  const parser = nodeStream.pipe(
    parse({
      columns: true, // Uses the first row as keys
      trim: true,
      skip_empty_lines: true,
      bom: true,
    })
  );

  let successCount = 0;
  let failureCount = 0;
  const errors: any[] = [];

  for await (const row of parser) {
    const leadInput = mapCsvRowToLeadInput(row, leadType, ownerId);

    // Basic validation
    if (!leadInput.ownerAddress) {
      // Skip rows without an address
      continue;
    }

    try {
      // 1. Validate Address with Google
      const searchAddress = `${leadInput.ownerAddress}, ${leadInput.ownerCity}, ${leadInput.ownerState} ${leadInput.ownerZip}`;
      const validation = await validateAddressWithGoogle(searchAddress);

      if (!validation.success || validation.isPartialMatch) {
        throw new Error(`Address validation failed: ${searchAddress}`);
      }

      // 2. Update input with standardized data
      leadInput.ownerAddress = validation.components.street;
      leadInput.ownerCity = validation.components.city;
      leadInput.ownerState = validation.components.state;
      leadInput.ownerZip = validation.components.zip;
      leadInput.standardizedAddress = validation.components;
      (leadInput as any).latitude = validation.location.lat;
      (leadInput as any).longitude = validation.location.lng;

      // 3. Save to Database
      await createLead(leadInput);
      successCount++;
    } catch (err: any) {
      console.warn(`Failed row: ${leadInput.ownerAddress}`, err.message);
      failureCount++;
      errors.push({ address: leadInput.ownerAddress, error: err.message });
    }
  }

  return { successCount, failureCount, errors };
}
