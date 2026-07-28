'use client';

import { useCallback, useEffect, useState } from 'react';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { DuplicateLeadList } from './DuplicateLeadList';
import { UploadWarnings } from './UploadWarnings';

type UploadJob = {
  id: string;
  fileName?: string | null;
  leadType?: string | null;
  status?: string | null;
  totalRows?: number | null;
  successCount?: number | null;
  duplicateCount?: number | null;
  errorCount?: number | null;
  errorMessage?: string | null;
  warnings?: (string | null)[] | null;
  duplicateLeads?: any;
  createdAt?: string | null;
  completedAt?: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-gray-100 text-gray-700',
  FAILED: 'bg-red-100 text-red-800',
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

/**
 * Upload history: every CsvUploadJob for the signed-in user, newest first, with the duplicate
 * report for the selected job.
 *
 * Exists because the duplicate report was previously reachable only from the live upload modal —
 * once the user navigated away there was no way back to it. `CsvUploadJob` is `allow.owner()`, so
 * the list is scoped to the caller by the API and needs no client-side owner filter.
 */
export function UploadHistoryClient() {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const all: UploadJob[] = [];
      let nextToken: string | null | undefined;
      do {
        const result = await client.models.CsvUploadJob.list({
          nextToken: nextToken ?? undefined,
        });
        all.push(...((result.data || []) as UploadJob[]));
        nextToken = result.nextToken;
      } while (nextToken);

      // Newest first. createdAt is an ISO string, so lexicographic compare is chronological.
      all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setJobs(all);
      setSelectedId((current) => current ?? all[0]?.id ?? null);
    } catch (err: any) {
      console.error('Failed to load upload history:', err);
      setError(err?.message || 'Could not load upload history.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const selected = jobs.find((j) => j.id === selectedId) || null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
        <p className="text-sm text-red-800">{error}</p>
        <button
          onClick={loadJobs}
          className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <p className="text-sm text-gray-600 py-8 text-center">
        No uploads yet.{' '}
        <a href="/upload" className="text-blue-600 underline hover:text-blue-800">
          Upload a CSV
        </a>{' '}
        to get started.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2 font-medium">File</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-right px-3 py-2 font-medium">Rows</th>
              <th className="text-right px-3 py-2 font-medium">Imported</th>
              <th className="text-right px-3 py-2 font-medium">Duplicates</th>
              <th className="text-right px-3 py-2 font-medium">Errors</th>
              <th className="text-left px-3 py-2 font-medium">Completed</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr
                key={job.id}
                onClick={() => setSelectedId(job.id)}
                className={`border-t cursor-pointer hover:bg-blue-50 ${
                  job.id === selectedId ? 'bg-blue-50' : ''
                }`}
              >
                <td className="px-3 py-2 max-w-[220px] truncate" title={job.fileName || ''}>
                  {job.fileName || '—'}
                </td>
                <td className="px-3 py-2 text-gray-600">{job.leadType || '—'}</td>
                <td className="px-3 py-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      STATUS_STYLES[job.status || ''] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {job.status || 'UNKNOWN'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{job.totalRows ?? 0}</td>
                <td className="px-3 py-2 text-right text-green-700">{job.successCount ?? 0}</td>
                <td className="px-3 py-2 text-right text-yellow-700">{job.duplicateCount ?? 0}</td>
                <td className="px-3 py-2 text-right text-red-700">{job.errorCount ?? 0}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                  {formatDate(job.completedAt || job.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <div>
            <h2 className="font-semibold text-gray-900">{selected.fileName || 'Upload'}</h2>
            <p className="text-xs text-gray-500">
              {selected.successCount ?? 0} imported · {selected.duplicateCount ?? 0} duplicates ·{' '}
              {selected.errorCount ?? 0} errors
            </p>
          </div>

          {selected.status === 'FAILED' && selected.errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-sm text-red-800">{selected.errorMessage}</p>
            </div>
          )}

          <UploadWarnings warnings={selected.warnings} />

          {(selected.successCount ?? 0) > 0 && (selected.warnings?.length ?? 0) > 0 && (
            <p className="text-xs text-gray-500">
              The leads imported normally — only the flagged enrichment is missing.
            </p>
          )}

          {(selected.duplicateLeads?.length ?? 0) > 0 ? (
            <DuplicateLeadList
              duplicateLeads={selected.duplicateLeads}
              fileName={selected.fileName}
              maxHeightClass="max-h-[420px]"
            />
          ) : (
            <p className="text-sm text-gray-600">
              {(selected.duplicateCount ?? 0) > 0
                ? // duplicateCount is incremented per row, but only the first MAX_DUPLICATE_STORE
                  // (100) entries are persisted — so a count without a list means the cap was hit.
                  `${selected.duplicateCount} duplicates were detected, but the detailed list was not stored for this upload.`
                : 'No duplicates in this upload.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
