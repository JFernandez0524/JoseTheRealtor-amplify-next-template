// app/api/v1/upload-csv/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { verifyAddress } from '@/src/lib/batchData';
import { client } from '@/src/lib/amplifyClient.server';
import {
  ProbateLeadSchema,
  PreforeclosureLeadSchema,
  LeadInput,
} from '@/src/types/leads';
import type { Schema } from '@/amplify/data/resource';
import { detectLeadType } from '@/src/lib/detectLeadType';

type LeadModel = Schema['Lead']['type']; // Amplify model type returned by .create()

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file || file.type !== 'text/csv') {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a CSV file.' },
        { status: 400 }
      );
    }

    const text = await file.text();
    const rawRows = parse<Record<string, any>>(text, {
      columns: true,
      trim: true,
    });

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: 'The uploaded CSV file is empty.' },
        { status: 400 }
      );
    }

    // Determine lead type from headers in first row
    const leadType = detectLeadType(rawRows[0]);
    if (leadType === 'unknown') {
      return NextResponse.json(
        { error: 'Unable to determine lead type from CSV headers.' },
        { status: 400 }
      );
    }

    const schema =
      leadType === 'probate' ? ProbateLeadSchema : PreforeclosureLeadSchema;

    const validLeads: LeadModel[] = [];
    const rejected: Array<{
      rowNumber: number;
      reason: string;
      errors?: unknown;
      row?: unknown;
      message?: string;
    }> = [];

    for (const [index, row] of rawRows.entries()) {
      try {
        // 1) Zod validation
        const parsed = schema.safeParse(row);
        if (!parsed.success) {
          rejected.push({
            rowNumber: index + 1,
            reason: 'Validation failed',
            errors: parsed.error.errors,
            row,
          });
          continue;
        }
        const leadData = parsed.data;

        // 2) Address verification (BatchData)
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
            row,
          });
          continue;
        }

        // 3) Build the final lead payload (union-narrowed)
        let payload: LeadInput;
        if (leadType === 'probate') {
          payload = {
            ...(leadData as any),
            type: 'probate',
            standardizedAddress: verification.standardized_address,
            createdAt: new Date(), // a.datetime() accepts Date
          };
        } else {
          payload = {
            ...(leadData as any),
            type: 'preforeclosure',
            standardizedAddress: verification.standardized_address,
            createdAt: new Date(),
          };
        }

        // 4) Store in Amplify Data
        const { data: createdLead, errors } =
          await client.models.Lead.create(payload);

        if (errors?.length) {
          rejected.push({
            rowNumber: index + 1,
            reason: 'Amplify Data error',
            errors,
          });
          continue;
        }

        if (createdLead) {
          validLeads.push(createdLead);
        }
      } catch (err) {
        console.error(`Error processing row ${index + 1}:`, err);
        rejected.push({
          rowNumber: index + 1,
          reason: 'Unexpected error',
          message: (err as Error).message,
        });
      }
    }

    return NextResponse.json({
      message: `CSV processed successfully as ${leadType} leads.`,
      stored: validLeads.length,
      rejected: rejected.length,
      preview: validLeads.slice(0, 5),
    });
  } catch (error) {
    console.error('Upload handler error:', error);
    return NextResponse.json(
      { error: 'Internal server error while processing CSV upload.' },
      { status: 500 }
    );
  }
}
