'use client';

import { useEffect, useState } from 'react';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';

export function UploadProgress() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkJobs();
    const interval = setInterval(checkJobs, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const checkJobs = async () => {
    try {
      const user = await getFrontEndUser();
      if (!user) return;

      const { data } = await client.models.CsvUploadJob.list({
        filter: {
          userId: { eq: user.userId },
          status: { eq: 'PROCESSING' }
        }
      });

      setJobs(data || []);
    } catch (error) {
      console.error('Error checking upload jobs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || jobs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm z-50">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Processing Uploads</h3>
      {jobs.map((job) => (
        <div key={job.id} className="mb-3 last:mb-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600">{job.fileName}</span>
            <span className="text-xs text-blue-600 font-medium">
              {job.processedRows || 0} rows
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full animate-pulse"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
