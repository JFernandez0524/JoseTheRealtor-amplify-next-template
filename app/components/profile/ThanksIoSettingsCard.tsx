'use client';

import { useState, useEffect } from 'react';
import { HiOutlineEnvelope, HiOutlineCheckCircle, HiOutlineClipboardDocument, HiOutlineArrowTopRightOnSquare } from 'react-icons/hi2';

const WEBHOOK_URL = 'https://turhumn37zo2ksb5pfckwbyi7m0hssnq.lambda-url.us-east-1.on.aws/';
const PARTNER_URL = 'https://dashboard.thanks.io/r/W6R43LEQ';

export default function ThanksIoSettingsCard() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load status
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/thanksio/lists');
      const data = await res.json();
      setIsConnected(!!data.connected);
      if (data.accountEmail) setAccountEmail(data.accountEmail);
    } catch (err: any) {
      setIsConnected(false);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/thanksio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect');

      setApiKey('');
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Thanks.io direct mail integration?')) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/thanksio/connect', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect');

      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className='bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-pulse'>
        <div className='h-5 bg-slate-200 rounded w-1/3 mb-2'></div>
        <div className='h-4 bg-slate-100 rounded w-2/3'></div>
      </div>
    );
  }

  return (
    <div className='bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6'>
      <div className='flex items-start justify-between'>
        <div className='flex items-center gap-3'>
          <div className='w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl'>
            <HiOutlineEnvelope />
          </div>
          <div>
            <h2 className='text-base font-bold text-slate-900'>Direct Mail Integration (Thanks.io)</h2>
            <p className='text-xs text-slate-500'>
              Automated handwritten postcards &amp; letters with live QR scan alerts.
            </p>
          </div>
        </div>

        {isConnected ? (
          <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200'>
            <HiOutlineCheckCircle className='text-sm' />
            Connected
          </span>
        ) : (
          <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200'>
            Not Connected
          </span>
        )}
      </div>

      {/* CONNECTED STATE */}
      {isConnected ? (
        <div className='space-y-4'>
          <div className='bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2'>
            <div className='flex justify-between items-center text-xs'>
              <span className='font-semibold text-slate-700'>Account Status:</span>
              <span className='text-slate-600'>{accountEmail || 'Active Tenant Key'}</span>
            </div>
            <div className='text-xs text-slate-500'>
              All direct mail sends use your own Thanks.io API token and bill to your Thanks.io payment method.
            </div>
          </div>

          {/* Webhook Configuration */}
          <div className='space-y-2'>
            <label className='block text-xs font-bold uppercase tracking-wider text-slate-700'>
              Your Direct Mail Webhook URL
            </label>
            <p className='text-xs text-slate-500'>
              Paste this URL into your Thanks.io dashboard (<strong>Profile &gt; Webhooks</strong>) to track delivery and QR scans:
            </p>
            <div className='flex items-center gap-2'>
              <input
                type='text'
                readOnly
                value={WEBHOOK_URL}
                className='flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 select-all'
              />
              <button
                type='button'
                onClick={copyWebhook}
                className='inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-xl text-xs transition'
              >
                <HiOutlineClipboardDocument className='text-sm' />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* QR Code & Landing Page Guidance */}
          <div className='bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-1.5'>
            <p className='font-bold text-blue-950 flex items-center gap-1.5'>
              <span>💡</span> QR Code Destination URL (Your Website / Calendar)
            </p>
            <p>
              When setting up your postcard or letter design templates in Thanks.io, enter <strong>your own website, landing page, or GoHighLevel booking calendar link</strong> as the QR destination URL.
            </p>
            <p className='text-blue-800'>
              Thanks.io will automatically wrap the QR code with tracking, fire an engagement webhook to your CRM the moment a lead scans it, and forward them straight to your page.
            </p>
          </div>

          {/* Orders & Reports Direct Link */}
          <div className='flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100'>
            <a
              href='https://dashboard.thanks.io/orders'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl text-xs transition shadow-sm'
            >
              <span>View Orders &amp; USPS Tracking on Thanks.io</span>
              <HiOutlineArrowTopRightOnSquare className='text-sm text-slate-400' />
            </a>

            <button
              type='button'
              disabled={isSubmitting}
              onClick={handleDisconnect}
              className='text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl border border-red-200 transition text-center'
            >
              {isSubmitting ? 'Disconnecting…' : 'Disconnect Thanks.io'}
            </button>
          </div>
        </div>
      ) : (
        /* NOT CONNECTED STATE */
        <div className='space-y-5'>
          <div className='bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-2'>
            <p className='font-bold text-blue-950'>
              🎁 $0/Month Software Add-On via Partner Link
            </p>
            <p>
              Direct mail automation is included at <strong>$0 extra software cost</strong> when you create your account through our official Thanks.io partner link. You pay Thanks.io directly for actual print and postage (~$0.73/card).
            </p>
          </div>

          <div className='space-y-2'>
            <span className='block text-xs font-bold uppercase tracking-wider text-slate-700'>
              Step 1: Create your Thanks.io account
            </span>
            <a
              href={PARTNER_URL}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center justify-between w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition shadow-sm'
            >
              <span>Register via Partner Portal</span>
              <HiOutlineArrowTopRightOnSquare className='text-sm text-slate-400' />
            </a>
          </div>

          <form onSubmit={handleConnect} className='space-y-3 pt-2 border-t border-slate-100'>
            <span className='block text-xs font-bold uppercase tracking-wider text-slate-700'>
              Step 2: Paste your API Token
            </span>
            <p className='text-xs text-slate-500'>
              Find your token in Thanks.io under <strong>API &amp; Integrations</strong>.
            </p>
            <div>
              <input
                type='password'
                placeholder='Enter Thanks.io API Token…'
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className='w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500'
                required
              />
            </div>

            {error && (
              <p className='text-xs font-medium text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200'>
                {error}
              </p>
            )}

            <button
              type='submit'
              disabled={isSubmitting || !apiKey.trim()}
              className='w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl disabled:opacity-50 transition shadow-sm'
            >
              {isSubmitting ? 'Verifying Key…' : 'Connect Thanks.io Account'}
            </button>
          </form>
        </div>
      )}

      {/* Affiliate & Legal Compliance Notice */}
      <div className='pt-3 border-t border-slate-100 text-[11px] text-slate-400 space-y-1 leading-relaxed'>
        <p>
          <strong>Affiliate &amp; Compliance Notice:</strong> We are an independent partner of Thanks.io and may receive referral credit or compensation when you register via our partner link.
        </p>
        <p>
          Users are solely responsible for ensuring their direct mail templates, return addresses, and copy comply with USPS domestic mail standards, state real estate licensing requirements, and the Fair Housing Act.
        </p>
      </div>
    </div>
  );
}
