'use client';

import { useState } from 'react';
import { useGhl } from '@/app/context/GhlContext';
import { client } from '@/app/utils/aws/data/frontEndClient';

export default function GhlSettingsCard() {
  const { isConnected, locationId, integrationId, isLoading } = useGhl();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = () => {
    window.location.href = '/api/v1/oauth/start';
  };

  const handleDisconnect = async () => {
    if (!integrationId) return;

    if (!confirm('Are you sure you want to disconnect your GHL account?'))
      return;

    setDisconnecting(true);
    try {
      await client.models.GhlIntegration.update({
        id: integrationId,
        isActive: false,
      });
      alert('✅ GHL account disconnected');
      window.location.reload(); // Refresh to update context
    } catch (error) {
      console.error('Error disconnecting GHL:', error);
      alert('Failed to disconnect GHL account');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className='bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-black text-slate-900 flex items-center gap-2'>
          ⚙️ GoHighLevel Connection
        </h3>
        <div
          className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
        ></div>
      </div>

      {isLoading ? (
        <div className='animate-pulse'>
          <div className='h-4 bg-gray-200 rounded w-3/4 mb-2'></div>
          <div className='h-3 bg-gray-200 rounded w-1/2'></div>
        </div>
      ) : isConnected ? (
        <>
          <div className='bg-green-50 border border-green-200 rounded-xl p-4 mb-6'>
            <p className='text-xs font-bold text-green-900 mb-1'>
              ✅ Connected
            </p>
            <p className='text-xs text-green-700'>
              Location ID: <span className='font-mono'>{locationId}</span>
            </p>
          </div>

          <p className='text-sm text-slate-600 mb-6'>
            Configure your campaign phone number and email address for automated
            outreach.
          </p>

          {/*  <div className='space-y-4 mb-6'>
            <div className='bg-blue-50 border border-blue-200 rounded-xl p-4'>
              <p className='text-xs font-bold text-blue-900 mb-1'>📱 Campaign Phone</p>
              <p className='text-xs text-blue-700'>
                Select which GHL phone number to use for SMS campaigns. All text messages will be sent from this number.
              </p>
            </div> */}

          {/* <div className='bg-green-50 border border-green-200 rounded-xl p-4'>
              <p className='text-xs font-bold text-green-900 mb-1'>📧 Campaign Email</p>
              <p className='text-xs text-green-700'>
                Set your verified email address for email campaigns. All prospecting emails will be sent from this address.
              </p>
            </div> 
          </div>*/}

          <div className='flex gap-3'>
            {/* <a
              href='/settings'
              className='flex-1 text-center bg-blue-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-colors'
            >
              Configure Settings
            </a> */}
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className='px-6 py-3 bg-red-100 text-red-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-200 transition-colors disabled:opacity-50'
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className='text-sm text-slate-600 mb-6'>
            Connect your GoHighLevel account to enable automated email and SMS
            campaigns.
          </p>

          <div className='bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6'>
            <p className='text-xs font-bold text-yellow-900 mb-2'>
              🔗 What you'll get:
            </p>
            <ul className='text-xs text-yellow-700 space-y-1 list-disc list-inside'>
              <li>Automated email campaigns to all leads</li>
              <li>AI-powered SMS outreach</li>
              <li>Reply and bounce handling</li>
              <li>Custom phone/email configuration</li>
            </ul>
          </div>

          <button
            onClick={handleConnect}
            className='w-full bg-blue-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-colors'
          >
            Connect GoHighLevel
          </button>
        </>
      )}
    </div>
  );
}
