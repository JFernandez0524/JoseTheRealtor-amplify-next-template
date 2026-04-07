'use client';

import { useState } from 'react';
import { CardWrapper } from './CardWrapper';
import { HiOutlinePhone, HiOutlineClock, HiOutlineCheckCircle, HiOutlineTag } from 'react-icons/hi2';
import { HiOutlineMail } from 'react-icons/hi';
import axios from 'axios';

interface OutreachData {
  smsAttempts?: number;
  emailAttempts?: number;
  lastSmsSent?: string;
  lastEmailSent?: string;
  smsStatus?: string;
  emailStatus?: string;
  callOutcome?: string;
  aiState?: string;
  tags?: string[];
}

interface OutreachStatusProps {
  ghlContactId?: string | null;
  outreachData?: OutreachData | null;
  onDataUpdate?: (data: OutreachData) => void;
}

export function OutreachStatus({ ghlContactId, outreachData, onDataUpdate }: OutreachStatusProps) {
  const [newTag, setNewTag] = useState('');
  const [isTagLoading, setIsTagLoading] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  if (!ghlContactId) {
    return (
      <CardWrapper title="📤 Outreach Status">
        <div className="text-sm text-gray-500 italic">
          Not synced to GHL yet
        </div>
      </CardWrapper>
    );
  }

  const addTag = async () => {
    if (!newTag.trim() || !ghlContactId) return;
    
    setIsTagLoading(true);
    setTagError(null);
    
    try {
      const response = await axios.post('/api/v1/ghl-tags', {
        contactId: ghlContactId,
        tag: newTag.trim()
      });
      
      if (onDataUpdate && response.data.tags) {
        onDataUpdate({ ...outreachData, tags: response.data.tags });
      }
      
      setNewTag('');
    } catch (error) {
      console.error('Failed to add tag:', error);
      setTagError('Failed to add tag');
    } finally {
      setIsTagLoading(false);
    }
  };

  const removeTag = async (tag: string) => {
    if (!ghlContactId) return;
    
    setIsTagLoading(true);
    setTagError(null);
    
    try {
      const response = await axios.delete(`/api/v1/ghl-tags?contactId=${ghlContactId}&tag=${encodeURIComponent(tag)}`);
      
      if (onDataUpdate && response.data.tags) {
        onDataUpdate({ ...outreachData, tags: response.data.tags });
      }
    } catch (error) {
      console.error('Failed to remove tag:', error);
      setTagError('Failed to remove tag');
    } finally {
      setIsTagLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    try {
      // Date-only strings (YYYY-MM-DD) anchored to noon to avoid UTC offset shifting the day
      const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
        ? `${dateString}T12:00:00`
        : dateString;
      const date = new Date(normalized);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
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
              <span className="text-sm font-medium text-gray-700">Call Outreach</span>
              <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(outreachData?.smsStatus)}`}>
                {outreachData?.smsStatus || 'PENDING'}
              </span>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <div>Call Attempts: <span className="font-medium">{outreachData?.smsAttempts || 0}/7</span></div>
              <div>Last call: <span className="font-medium">{formatDate(outreachData?.lastSmsSent)}</span></div>
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

        {/* GHL Tags */}
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
          <HiOutlineTag className="w-5 h-5 text-purple-600 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">GHL Tags</span>
              {isTagLoading && (
                <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            
            {/* Display Tags */}
            <div className="flex flex-wrap gap-1 mb-2">
              {outreachData?.tags?.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="text-purple-600 hover:text-purple-800 ml-1"
                    disabled={isTagLoading}
                  >
                    ×
                  </button>
                </span>
              ))}
              {(!outreachData?.tags || outreachData.tags.length === 0) && (
                <span className="text-gray-400 text-xs">No tags</span>
              )}
            </div>

            {/* Add Tag Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTag()}
                placeholder="Add tag..."
                className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-purple-500 outline-none"
                disabled={isTagLoading}
              />
              <button
                onClick={addTag}
                disabled={!newTag.trim() || isTagLoading}
                className="px-3 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600 disabled:opacity-50"
              >
                Add
              </button>
            </div>

            {tagError && (
              <div className="text-xs text-red-600 mt-1">{tagError}</div>
            )}
          </div>
        </div>
      </div>
    </CardWrapper>
  );
}
