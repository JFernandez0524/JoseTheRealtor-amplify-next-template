import { describe, it, expect } from 'vitest';
import {
  generateDuplicateComparisonCSV,
  type DuplicateLeadEntry,
} from '../../app/utils/csvExport';

// Pure CSV serializer for a CsvUploadJob's `duplicateLeads`. The shapes below are the ones that
// actually occur in production: `existingLeadData` was hardcoded null for every job written before
// it was populated, and intra-file duplicates have no `existingLeadId`.

const EXPECTED_HEADER =
  'CSV Owner Name,CSV Address,CSV City,CSV State,CSV Zip,' +
  'Existing Owner Name,Existing Address,Existing Zestimate,Existing Lead ID';

const csvRow = (entry: DuplicateLeadEntry): string =>
  generateDuplicateComparisonCSV([entry]).split('\n')[1];

describe('generateDuplicateComparisonCSV', () => {
  it('emits the header row even with no duplicates', () => {
    expect(generateDuplicateComparisonCSV([])).toBe(EXPECTED_HEADER);
  });

  it('does not throw when existingLeadData is null (the historical job shape)', () => {
    // Regression: this shape previously threw
    // "TypeError: Cannot read properties of null (reading 'ownerName')".
    const entry: DuplicateLeadEntry = {
      csvData: {
        ownerName: 'Peter J Scannapieco',
        address: '92 Mackenzie Lane South',
        city: 'Denville',
        state: 'NJ',
        zip: '07834',
      },
      existingLeadId: 'abc-123',
      existingLeadData: null,
    };

    expect(() => generateDuplicateComparisonCSV([entry])).not.toThrow();
    expect(csvRow(entry)).toBe(
      '"Peter J Scannapieco","92 Mackenzie Lane South","Denville","NJ","07834","","","","abc-123"'
    );
  });

  it('fills every column when existingLeadData is populated', () => {
    const entry: DuplicateLeadEntry = {
      csvData: {
        ownerName: 'Scott Caponegro',
        address: '34 Zacatin Road',
        city: 'Freehold',
        state: 'NJ',
        zip: '07728',
      },
      existingLeadId: 'lead-9',
      existingLeadData: {
        ownerName: 'S Caponegro',
        address: '34 Zacatin Rd, Freehold',
        zestimate: 1234567,
      },
    };

    expect(csvRow(entry)).toBe(
      '"Scott Caponegro","34 Zacatin Road","Freehold","NJ","07728",' +
        '"S Caponegro","34 Zacatin Rd, Freehold","$1,234,567","lead-9"'
    );
  });

  it('leaves the zestimate column empty when it is null or absent', () => {
    const withNull = csvRow({ existingLeadData: { zestimate: null } });
    const withAbsent = csvRow({ existingLeadData: {} });
    expect(withNull.split(',').at(-2)).toBe('""');
    expect(withAbsent.split(',').at(-2)).toBe('""');
  });

  it('renders a zestimate of 0 as $0 rather than blank', () => {
    // Guards against a truthiness check reappearing — 0 is a real value, not "missing".
    const row = csvRow({ existingLeadData: { zestimate: 0 } });
    expect(row).toContain('"$0"');
  });

  it('records an empty Existing Lead ID for intra-file duplicates', () => {
    const row = csvRow({
      csvData: { address: '2 Foxhill Run', city: 'South Brunswick' },
      existingLeadId: null,
      existingLeadData: null,
    });
    expect(row.endsWith(',""')).toBe(true);
  });

  it('skips null and undefined entries in the array', () => {
    const lines = generateDuplicateComparisonCSV([
      null,
      { csvData: { ownerName: 'Real Row' } },
      undefined,
    ]).split('\n');

    expect(lines).toHaveLength(2); // header + the one real row
    expect(lines[1]).toContain('"Real Row"');
  });

  it('tolerates an entry with no csvData at all', () => {
    expect(() => generateDuplicateComparisonCSV([{}])).not.toThrow();
    expect(csvRow({})).toBe('"","","","","","","","",""');
  });

  it('escapes embedded quotes by doubling them (RFC 4180)', () => {
    // Owner names from county files contain punctuation, e.g. `(deceased wife) Tarulli: catherine`.
    const row = csvRow({ csvData: { ownerName: 'Estate of "Bud" Tarulli' } });
    expect(row.startsWith('"Estate of ""Bud"" Tarulli"')).toBe(true);
  });

  it('keeps a comma-containing field inside a single quoted cell', () => {
    const row = csvRow({ csvData: { address: '631-635 Lake Street, Unit 2' } });
    expect(row).toContain('"631-635 Lake Street, Unit 2"');
    // Header has 9 columns; the row must still parse as 9 quoted cells.
    expect(row.match(/"/g)?.length).toBe(18);
  });

  it('produces one line per duplicate plus the header', () => {
    const entries: DuplicateLeadEntry[] = Array.from({ length: 8 }, (_, i) => ({
      csvData: { ownerName: `Owner ${i}` },
      existingLeadId: `id-${i}`,
      existingLeadData: null,
    }));
    expect(generateDuplicateComparisonCSV(entries).split('\n')).toHaveLength(9);
  });
});
