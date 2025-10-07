// app/api/upload-csv/route.ts

import { NextRequest, NextResponse } from 'next/server';
import formidable, { File, Files, IncomingForm } from 'formidable';
import { parse } from 'csv-parse';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // disable Next.js built-in body parsing
  },
};

interface CsvRow {
  [columnName: string]: string;
}

// Helper: parse the incoming form with formidable
function parseForm(
  req: NextRequest
): Promise<{ fields: Record<string, any>; files: Files }> {
  const form = new IncomingForm({
    keepExtensions: true,
    maxFiles: 1,
    // you can customize uploadDir, maxFileSize, etc here
  });

  return new Promise((resolve, reject) => {
    // Note: we need to pass the Node.js request object (not NextRequest)
    form.parse(req as any, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

export async function POST(req: NextRequest) {
  let fields: Record<string, any>, files: Files;
  try {
    ({ fields, files } = await parseForm(req));
  } catch (err: any) {
    console.error('Error parsing form:', err);
    return NextResponse.json(
      { error: 'Error parsing form data' },
      { status: 400 }
    );
  }

  // Ensure file was provided
  const fileKey = 'file';
  const maybeFile = files[fileKey];

  if (!maybeFile) {
    return NextResponse.json(
      { error: 'No file uploaded under key "file"' },
      { status: 400 }
    );
  }

  // types: maybeFile can be File or File[]
  const file: File = Array.isArray(maybeFile) ? maybeFile[0] : maybeFile;

  if (!file.filepath) {
    return NextResponse.json(
      { error: 'Uploaded file path not found' },
      { status: 400 }
    );
  }

  const records: CsvRow[] = [];

  // Create a readable stream and parse CSV
  const parser = fs
    .createReadStream(file.filepath)
    .pipe(parse({ columns: true, skip_empty_lines: true }))
    .on('data', (row: CsvRow) => {
      records.push(row);
    });

  try {
    await new Promise<void>((resolve, reject) => {
      parser.on('end', resolve);
      parser.on('error', reject);
    });
  } catch (err) {
    console.error('CSV parse error:', err);
    return NextResponse.json(
      { error: 'Error parsing CSV file' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: `Parsed ${records.length} rows`,
    preview: records.slice(0, 5),
  });
}
