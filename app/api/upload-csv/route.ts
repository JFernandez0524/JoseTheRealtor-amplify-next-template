// app/api/upload-csv/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'csv-parse';
import fs from 'fs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file || file.type !== 'text/csv') {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    const text = await file.text();
    const records: any[] = [];

    await new Promise((resolve, reject) => {
      parse(text, { columns: true, trim: true })
        .on('data', (row) => records.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    // Limit preview to first 5 records
    const preview = records.slice(0, 5);
    console.log('Parsed records:', records);

    return NextResponse.json({
      message: 'File uploaded and parsed successfully',
      preview,
    });
  } catch (error) {
    console.error('Error processing file:', error);
    return NextResponse.json(
      { error: 'Error processing file' },
      { status: 500 }
    );
  }
}
