'use client';

import { CardWrapper } from './CardWrapper';
import { HiOutlinePhone, HiOutlineMail, HiOutlineClock, HiOutlineCheckCircle } from 'react-icons/hi2';

interface OutreachData {
  smsAttempts?: number;
  emailAttempts?: number;
  lastSmsSent?: string;
  lastEmailSent?: string;
  smsStatus?: string;
  emailStatus?: string;
  callOutcome?: string;
  aiState?: string;
}

interface OutreachStatusProps {
  ghlContactId?: string | null;
  outreachData?: OutreachData | null;
}

export function OutreachStatus({ ghlContactId, outreachData }: OutreachStatusProps) {
  if (!ghlContactId) {
    return (
      <CardWrapper title="📤 Outreach Status">
        <div className="text-sm text-gray-500 italic">
          Not synced to GHL yet
        </div>
      </CardWrapper>
    );
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'REPLIED': return 'text-green-600 bg-green-50';
      case 'PENDING': return 'text-blue-600 bg-blue-50';
      case 'OPTED_OUT': return 'text-red-600 bg-red-50';
      case 'BOUNCED': return 'text-orange-600 bg-orange-50';
      case 'FAILED': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getAIStateDisplay = (state?: string) => {
    switch (state) {
      case 'running': return { text: 'AI Active', color: 'text-blue-600 bg-blue-50' };
      case 'handoff': return { text: 'Ready for Human', color: 'text-green-600 bg-green-50' };
      case 'not_started': return { text: 'Not Started', color: 'text-gray-600 bg-gray-50' };
      default: return { text: 'Unknown', color: 'text-gray-600 bg-gray-50' };
    }
  };

  const aiStateDisplay = getAIStateDisplay(outreachData?.aiState);

  return (
    <CardWrapper title="📤 Outreach Status">
      <div className="space-y-4">
        {/* SMS Outreach */}
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
          <HiOutlinePhone className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">SMS Outreach</span>
              <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(outreachData?.smsStatus)}`}>
                {outreachData?.smsStatus || 'PENDING'}
              </span>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <div>Attempts: <span className="font-medium">{outreachData?.smsAttempts || 0}/7</span></div>
              <div>Last sent: <span className="font-medium">{formatDate(outreachData?.lastSmsSent)}</span></div>
            </div>
          </div>
        </div>

        {/* Email Outreach */}
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
          <HiOutlineMail className="w-5 h-5 text-purple-600 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">Email Outreach</span>
              <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(outreachData?.emailStatus)}`}>
                {outreachData?.emailStatus || 'PENDING'}
              </span>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <div>Attempts: <span className="font-medium">{outreachData?.emailAttempts || 0}/7</span></div>
              <div>Last sent: <span className="font-medium">{formatDate(outreachData?.lastEmailSent)}</span></div>
            </div>
          </div>
        </div>

        {/* AI State */}
        {outreachData?.aiState && (
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <HiOutlineClock className="w-5 h-5 text-indigo-600 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">AI Status</span>
                <span className={`text-xs px-2 py-1 rounded-full ${aiStateDisplay.color}`}>
                  {aiStateDisplay.text}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Call Outcome */}
        {outreachData?.callOutcome && (
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <HiOutlineCheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Call Outcome</span>
                <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-600">
                  {outreachData.callOutcome}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </CardWrapper>
  );
}
