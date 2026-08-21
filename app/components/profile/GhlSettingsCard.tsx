'use client';

import { useState, useEffect } from 'react';
import { useGhl } from '@/app/context/GhlContext';
import { useAccess } from '@/app/context/AccessContext';
import { client } from '@/app/utils/aws/data/frontEndClient';

export default function GhlSettingsCard() {
  const { isConnected, locationId, integrationId, isLoading } = useGhl();
  const { hasPaidPlan } = useAccess();
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [manualLocationId, setManualLocationId] = useState('');
  const [showDirectInstall, setShowDirectInstall] = useState(false);

  // Private Integration Token (PIT) state
  const [pitLocationId, setPitLocationId] = useState('');
  const [pitToken, setPitToken] = useState('');
  const [connectingPit, setConnectingPit] = useState(false);
  const [pitError, setPitError] = useState<string | null>(null);
  const [showPitForm, setShowPitForm] = useState(false);

  const handleConnect = () => {
    setConnecting(true);
    window.location.href = '/api/v1/oauth/start';
  };

  const handleDirectInstall = () => {
    const cleanId = manualLocationId.trim();
    if (!cleanId) {
      alert('Please enter your GoHighLevel Sub-Account (Location) ID.');
      return;
    }
    const directUrl = `https://app.leadconnectorhq.com/v2/location/${cleanId}/integration/6a36bd98f0df01764c99b25d/versions/6a36bd98f0df01764c99b25d`;
    window.open(directUrl, '_blank', 'noopener,noreferrer');
  };

  const handleConnectPit = async (e: React.FormEvent) => {
    e.preventDefault();
    const locId = pitLocationId.trim();
    const token = pitToken.trim();

    if (!locId || !token) {
      setPitError('Please enter both your Location ID and Private Integration Token.');
      return;
    }

    setConnectingPit(true);
    setPitError(null);

    try {
      const res = await fetch('/api/v1/ghl/connect-pit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: locId, pitToken: token }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect Private Integration Token');
      }

      alert('✅ GoHighLevel connected successfully via Private Integration Token!');
      window.location.reload();
    } catch (err: any) {
      console.error('PIT connection error:', err);
      setPitError(err.message || 'Failed to connect. Please check your token and location ID.');
    } finally {
      setConnectingPit(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Launch AI system?'))
      return;

    setDisconnecting(true);
    try {
      const res = await fetch('/api/v1/ghl/disconnect', { method: 'POST' });
      if (!res.ok) {
        if (integrationId) {
          await client.models.GhlIntegration.update({
            id: integrationId,
            isActive: false,
          });
        }
      }
      alert('✅ Launch AI system disconnected.');
      window.location.reload();
    } catch (error: any) {
      console.error('Error disconnecting GHL:', error);
      try {
        if (integrationId) {
          await client.models.GhlIntegration.update({
            id: integrationId,
            isActive: false,
          });
          alert('✅ Launch AI system disconnected.');
          window.location.reload();
          return;
        }
      } catch (fallbackError) {
        console.error('Fallback disconnect error:', fallbackError);
      }
      alert(`Failed to disconnect Launch AI system: ${error.message}`);
    } finally {
      setDisconnecting(false);
    }
  };

  const [healthState, setHealthState] = useState<{
    status: 'LOADING' | 'HEALTHY' | 'REAUTH_REQUIRED' | 'DISCONNECTED';
    recovered?: boolean;
    message?: string;
  }>({ status: 'LOADING' });

  useEffect(() => {
    if (isConnected) {
      fetch('/api/v1/ghl/health')
        .then((res) => res.json())
        .then((data) => {
          setHealthState({
            status: data.status || 'HEALTHY',
            recovered: data.recovered,
            message: data.message,
          });
        })
        .catch(() => setHealthState({ status: 'HEALTHY' }));
    }
  }, [isConnected]);

  return (
    <div className='bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-black text-slate-900 flex items-center gap-2'>
          ⚙️ Launch AI Connection
        </h3>
        <div
          className={`w-3 h-3 rounded-full ${
            healthState.status === 'REAUTH_REQUIRED'
              ? 'bg-amber-500 animate-ping'
              : isConnected
              ? 'bg-green-500'
              : 'bg-red-500'
          }`}
        ></div>
      </div>

      {isLoading ? (
        <div className='animate-pulse'>
          <div className='h-4 bg-gray-200 rounded w-3/4 mb-2'></div>
          <div className='h-3 bg-gray-200 rounded w-1/2'></div>
        </div>
      ) : isConnected ? (
        <>
          {healthState.status === 'REAUTH_REQUIRED' ? (
            <div className='bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6'>
              <p className='text-xs font-bold text-amber-900 mb-1'>
                ⚠️ Re-authorization Needed
              </p>
              <p className='text-xs text-amber-700 mb-3'>
                {healthState.message || 'Your Launch AI session needs to be re-authorized.'}
              </p>
              <button
                onClick={handleConnect}
                className='px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors'
              >
                ⚡ Reconnect Launch AI
              </button>
            </div>
          ) : (
            <div className='bg-green-50 border border-green-200 rounded-xl p-4 mb-6'>
              <p className='text-xs font-bold text-green-900 mb-1'>
                ✅ Connected & Active {healthState.recovered && '(Auto-Recovered ⚡)'}
              </p>
              <p className='text-xs text-green-700'>
                Location ID: <span className='font-mono'>{locationId}</span>
              </p>
            </div>
          )}

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
            Connect your Launch AI system to enable automated email and SMS
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

          {hasPaidPlan ? (
            <>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className='w-full inline-flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-75 transition-colors'
              >
                {connecting && (
                  <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {connecting ? 'Redirecting to GoHighLevel...' : 'Connect Launch AI'}
              </button>

              <div className='mt-5 pt-4 border-t border-slate-200 space-y-4'>
                {/* Method 1: Private Integration Token (PIT) */}
                <div className='bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <p className='text-xs font-bold text-indigo-950 flex items-center gap-1.5'>
                        🔑 Connect via Private Integration Token (PIT)
                        <span className='bg-indigo-200 text-indigo-800 text-[10px] font-black px-1.5 py-0.5 rounded'>Instant</span>
                      </p>
                      <p className='text-[11px] text-indigo-800 mt-0.5'>
                        Direct API connection — bypasses marketplace approvals completely.
                      </p>
                    </div>
                    <button
                      type='button'
                      onClick={() => setShowPitForm(!showPitForm)}
                      className='text-xs font-bold text-indigo-600 hover:text-indigo-800 underline'
                    >
                      {showPitForm ? 'Close' : 'Connect PIT'}
                    </button>
                  </div>

                  {showPitForm && (
                    <form onSubmit={handleConnectPit} className='mt-3.5 pt-3 border-t border-indigo-100 space-y-3'>
                      {pitError && (
                        <div className='p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700'>
                          ⚠️ {pitError}
                        </div>
                      )}

                      <div>
                        <label className='block text-xs font-bold text-slate-700 mb-1'>
                          1. Sub-Account (Location) ID:
                        </label>
                        <input
                          type='text'
                          value={pitLocationId}
                          onChange={(e) => setPitLocationId(e.target.value)}
                          placeholder='e.g. r03G6gdDLoszFIUnUABU'
                          className='w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'
                          required
                        />
                        <p className='text-[10px] text-slate-500 mt-0.5'>
                          Found in HighLevel under <em>Settings → Business Profile</em>.
                        </p>
                      </div>

                      <div>
                        <label className='block text-xs font-bold text-slate-700 mb-1'>
                          2. Private Integration Token (PIT):
                        </label>
                        <input
                          type='password'
                          value={pitToken}
                          onChange={(e) => setPitToken(e.target.value)}
                          placeholder='pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
                          className='w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'
                          required
                        />
                        <p className='text-[10px] text-slate-500 mt-0.5'>
                          Generated in HighLevel under <em>Settings → Integrations → Private Integrations</em>.
                        </p>
                      </div>

                      <button
                        type='submit'
                        disabled={connectingPit}
                        className='w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2'
                      >
                        {connectingPit && (
                          <svg className="w-3.5 h-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                        {connectingPit ? 'Verifying & Connecting...' : 'Connect Private Token'}
                      </button>
                    </form>
                  )}
                </div>

                {/* Method 2: Direct Install Link */}
                <div className='pt-1'>
                  <button
                    type='button'
                    onClick={() => setShowDirectInstall(!showDirectInstall)}
                    className='text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 mx-auto'
                  >
                    <span>{showDirectInstall ? '▲ Hide direct test install' : '▼ Have a Sub-Account ID? Connect test draft link'}</span>
                  </button>

                  {showDirectInstall && (
                    <div className='mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2'>
                      <p className='text-xs text-slate-700 font-semibold'>
                        Direct Sub-Account Installation Link:
                      </p>
                      <p className='text-[11px] text-slate-500 leading-relaxed'>
                        Enter your GoHighLevel Sub-Account (Location) ID below to open your customized direct install page in HighLevel.
                      </p>
                      <div className='flex gap-2 pt-1'>
                        <input
                          type='text'
                          value={manualLocationId}
                          onChange={(e) => setManualLocationId(e.target.value)}
                          placeholder='e.g. mHaAy3ZaUHgrbPyughDG'
                          className='flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
                        />
                        <button
                          type='button'
                          onClick={handleDirectInstall}
                          className='px-3.5 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors whitespace-nowrap'
                        >
                          Install ↗
                        </button>
                      </div>
                      <p className='text-[10px] text-slate-400'>
                        Location ID is found in GoHighLevel under <em>Settings → Business Profile</em> or in your browser URL.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <a href="/pricing" className='block text-center w-full bg-indigo-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors'>
              Upgrade to Connect Launch AI
            </a>
          )}
        </>
      )}
    </div>
  );
}
