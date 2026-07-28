'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { DuplicateLeadList } from './DuplicateLeadList';
import { UploadWarnings } from './UploadWarnings';

interface UploadProgressModalProps {
  jobId: string;
}

export function UploadProgressModal({ jobId }: UploadProgressModalProps) {
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 5;

  useEffect(() => {
    if (!jobId) return;

    const checkProgress = async () => {
      try {
        const { data } = await client.models.CsvUploadJob.get({ id: jobId });
        
        if (data) {
          setJob(data);
          setIsLoading(false);
          
          // Keep modal open for 3 seconds when completed to show summary. If the upload produced
          // duplicates or warnings, don't auto-redirect — the user needs time to read them and
          // download the report; they can leave via the explicit "View Dashboard Now" button.
          const needsAttention =
            (data.duplicateLeads?.length ?? 0) > 0 || (data.warnings?.length ?? 0) > 0;
          if (data.status === 'COMPLETED' && !needsAttention) {
            setTimeout(() => {
              router.push('/dashboard');
            }, 3000);
          }
        } else if (retryCount < MAX_RETRIES) {
          // Job not found yet, retry (DynamoDB consistency)
          setRetryCount(prev => prev + 1);
        } else {
          // Max retries reached, stop loading
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error checking upload progress:', error);
        if (retryCount < MAX_RETRIES) {
          setRetryCount(prev => prev + 1);
        } else {
          setIsLoading(false);
        }
      }
    };

    checkProgress();
    const interval = setInterval(checkProgress, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [jobId, router, retryCount]);

  if (isLoading || !job || job.status === 'PENDING') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Initializing upload...</p>
          </div>
        </div>
      </div>
    );
  }

  const percentage = job.totalRows > 0
    ? Math.round((job.processedRows / job.totalRows) * 100)
    : 0;

  const hasDuplicates = (job.duplicateLeads?.length ?? 0) > 0;
  const hasWarnings = (job.warnings?.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {job.status === 'PROCESSING' ? 'Processing Upload' : 
               job.status === 'COMPLETED' ? 'Upload Complete!' : 
               'Upload Failed'}
            </h2>
            <p className="text-sm text-gray-600">{job.fileName}</p>
          </div>

          {/* Progress Bar */}
          {job.status === 'PROCESSING' && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Progress</span>
                  <span className="font-semibold">{percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="text-center text-sm text-gray-500">
                  {job.processedRows} of {job.totalRows} rows processed
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {job.successCount || 0}
                  </div>
                  <div className="text-xs text-gray-500">Success</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {job.duplicateCount || 0}
                  </div>
                  <div className="text-xs text-gray-500">Duplicates</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {job.errorCount || 0}
                  </div>
                  <div className="text-xs text-gray-500">Errors</div>
                </div>
              </div>

              {/* Duplicate Leads List */}
              <DuplicateLeadList
                duplicateLeads={job.duplicateLeads}
                fileName={job.fileName}
              />

              {/* Loading Animation */}
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            </>
          )}

          {/* Completed State */}
          {job.status === 'COMPLETED' && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 text-center">
                  {hasDuplicates || hasWarnings
                    ? '✅ Upload complete — review the notes below before continuing.'
                    : '✅ Upload completed successfully! Redirecting to dashboard...'}
                </p>
              </div>

              <UploadWarnings warnings={job.warnings} />

              {/* Show duplicate list + download if duplicates exist */}
              {hasDuplicates && (
                <div className="space-y-2">
                  <DuplicateLeadList
                    duplicateLeads={job.duplicateLeads}
                    fileName={job.fileName}
                    maxHeightClass="max-h-[240px]"
                  />
                  <p className="text-xs text-gray-600 text-center">
                    These leads already exist in your database and were not imported. You can
                    revisit this report any time from{' '}
                    <a href="/uploads" className="text-blue-600 underline hover:text-blue-800">
                      Upload History
                    </a>
                    .
                  </p>
                </div>
              )}

              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Dashboard Now
              </button>
            </div>
          )}

          {/* Failed State */}
          {job.status === 'FAILED' && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  {job.errorMessage || 'An error occurred during upload'}
                </p>
              </div>
              <button
                onClick={() => router.push('/upload')}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
