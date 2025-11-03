export type LeadType = 'probate' | 'preforeclosure' | 'unknown';

/**
 * Detect lead type based on CSV headers or first record fields.
 */
export function detectLeadType(record: Record<string, any>): LeadType {
  const keys = Object.keys(record).map((k) => k.toLowerCase());

  if (keys.includes('executorfirstname') || keys.includes('executorlastname')) {
    return 'probate';
  }
  if (keys.includes('borrowerfirstname') || keys.includes('casenumber')) {
    return 'preforeclosure';
  }
  return 'unknown';
}
