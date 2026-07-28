'use client';

interface UploadWarningsProps {
  /** A CsvUploadJob's `warnings` array. Entries may be null on records written by older code. */
  warnings?: (string | null | undefined)[] | null;
}

/**
 * Amber callout for a CSV upload that COMPLETED but lost optional enrichment — currently only the
 * Bridge/Zillow credential outage that leaves leads without Zestimates.
 *
 * Deliberately distinct from the red FAILED treatment: the leads did import, so presenting this as
 * a failure would be misleading. Shared by `UploadProgressModal` and the upload history view.
 */
export function UploadWarnings({ warnings }: UploadWarningsProps) {
  const entries = (warnings ?? []).filter(Boolean) as string[];
  if (entries.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
      {entries.map((warning, idx) => (
        <p key={idx} className="text-sm text-amber-900 flex gap-2">
          <span aria-hidden="true">⚠️</span>
          <span>{warning}</span>
        </p>
      ))}
    </div>
  );
}
