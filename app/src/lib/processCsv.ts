import { parse } from 'csv-parse/sync';
import { verifyAddress } from './batchData';
import { detectLeadType } from './detectLeadType';
import {
  ProbateLeadSchema,
  PreforeclosureLeadSchema,
  LeadInput,
} from '@/app/src/types/leads';
import type { Schema } from '@/amplify/data/resource';

type LeadModel = Schema['Lead']['type'];

export interface CsvProcessResult {
  validLeads: LeadModel[];
  rejected: Array<{
    rowNumber: number;
    reason: string;
    message?: string;
  }>;
  leadType: string;
}

/**
 * Parses, validates, and enriches CSV content for Lead imports.
 * Returns both valid leads (ready to store) and rejected ones.
 */
export async function processCsvFile(
  file: File,
  userId: string
): Promise<CsvProcessResult> {
  const text = await file.text();
  const rows = parse<Record<string, any>>(text, { columns: true, trim: true });

  if (rows.length === 0) {
    throw new Error('CSV file is empty.');
  }

  const leadType = detectLeadType(rows[0]);
  if (leadType === 'unknown') {
    throw new Error('Unable to determine lead type from CSV headers.');
  }

  const schema =
    leadType === 'probate' ? ProbateLeadSchema : PreforeclosureLeadSchema;

  const validLeads: LeadModel[] = [];
  const rejected: CsvProcessResult['rejected'] = [];

  for (const [index, row] of rows.entries()) {
    try {
      // 1️⃣ Validate row
      const parsed = schema.safeParse(row);
      if (!parsed.success) {
        rejected.push({
          rowNumber: index + 1,
          reason: 'Validation failed',
          message: JSON.stringify(parsed.error.errors),
        });
        continue;
      }

      const leadData = parsed.data;

      // 2️⃣ Verify address with BatchData
      const verification = await verifyAddress({
        address1: leadData.address,
        city: leadData.city,
        state: leadData.state,
        zip: leadData.zip,
      });
      if (!verification?.is_valid) {
        rejected.push({
          rowNumber: index + 1,
          reason: 'Address verification failed',
        });
        continue;
      }

      // 3️⃣ Build the final payload
      const payload: LeadInput = {
        ...(leadData as any),
        type: leadType,
        standardizedAddress: verification.standardized_address,
        createdAt: new Date(),
        owner: userId, // 👈 Add owner automatically
      };

      validLeads.push(payload as any);
    } catch (err) {
      rejected.push({
        rowNumber: index + 1,
        reason: 'Unexpected error',
        message: (err as Error).message,
      });
    }
  }

  return { validLeads, rejected, leadType };
}
