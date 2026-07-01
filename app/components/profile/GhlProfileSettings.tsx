'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import { HiOutlineUserCircle, HiOutlineCheckCircle } from 'react-icons/hi2';
import { useAccess } from '@/app/context/AccessContext';
import Link from 'next/link';

type GhlUser = { id: string; name: string; email: string };

export default function GhlProfileSettings() {
  const { hasPaidPlan } = useAccess();
  const searchParams = useSearchParams();
  const isSetupFlow = searchParams.get('setup') === '1';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState<any>(null);

  // Agent identity
  const [agentName, setAgentName] = useState('');
  const [agentBrokerage, setAgentBrokerage] = useState('');
  const [agentCalendarEmail, setAgentCalendarEmail] = useState('');
  const [aiPersona, setAiPersona] = useState('');
  const [aiExamples, setAiExamples] = useState('');

  // Campaign / GHL resources
  const [dialerUserId, setDialerUserId] = useState('');
  const [campaignPhone, setCampaignPhone] = useState('');
  const [campaignEmail, setCampaignEmail] = useState('');
  const [campaignCalendarId, setCampaignCalendarId] = useState('');
  const [emailSignature, setEmailSignature] = useState('');

  // Live GHL data
  const [ghlUsers, setGhlUsers] = useState<GhlUser[]>([]);
  const [usersError, setUsersError] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState<{ number: string; name: string }[]>([]);
  const [phonesLoaded, setPhonesLoaded] = useState(false);
  const [calendars, setCalendars] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const refreshPhoneNumbers = async () => {
    try {
      const res = await fetch('/api/v1/ghl-phone-numbers').then((r) => r.json());
      if (res?.success) {
        setPhoneNumbers(res.phoneNumbers || []);
        setPhonesLoaded(true);
      }
    } catch {
      /* non-fatal: picker falls back to the stored value */
    }
  };

  const refreshCalendars = async () => {
    try {
      const res = await fetch('/api/v1/ghl-calendars').then((r) => r.json());
      if (res?.success) setCalendars(res.calendars || []);
    } catch {
      /* non-fatal */
    }
  };

  const loadSettings = async () => {
    try {
      const user = await getFrontEndUser();
      if (!user) return;

      const { data: integrations } = await client.models.GhlIntegration.list({
        filter: { userId: { eq: user.userId }, isActive: { eq: true } },
      });

      if (integrations && integrations.length > 0) {
        const i = integrations[0];
        setIntegration(i);
        setAgentName(i.agentName || '');
        setAgentBrokerage(i.agentBrokerage || '');
        setAgentCalendarEmail(i.agentCalendarEmail || '');
        setAiPersona(i.aiPersona || '');
        setAiExamples(i.aiExamples || '');
        setDialerUserId(i.dialerUserId || '');
        setCampaignPhone(i.campaignPhone || '');
        setCampaignEmail(i.campaignEmail || '');
        setCampaignCalendarId(i.campaignCalendarId || '');
        setEmailSignature(i.emailSignature || '');

        // Fetch live GHL resources for the pickers (users, phone numbers, calendars)
        try {
          const res = await fetch('/api/v1/ghl-users');
          const data = await res.json();
          if (data.success) setGhlUsers(data.users || []);
          else setUsersError(data.error || 'Could not load GHL users');
        } catch {
          setUsersError('Could not load GHL users');
        }
        await Promise.all([refreshPhoneNumbers(), refreshCalendars()]);
      }
    } catch (error) {
      console.error('Error loading profile settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // A purchased GHL phone number is required for every account (skip tracing is phone-first).
  const noPhoneNumbers = phonesLoaded && phoneNumbers.length === 0;
  const requiredComplete = !!agentName && !!agentBrokerage && !!dialerUserId && !!campaignPhone && !noPhoneNumbers;

  const saveSettings = async () => {
    if (!integration) return;
    setSaving(true);
    try {
      await client.models.GhlIntegration.update({
        id: integration.id,
        agentName: agentName || null,
        agentBrokerage: agentBrokerage || null,
        agentCalendarEmail: agentCalendarEmail || null,
        aiPersona: aiPersona || null,
        aiExamples: aiExamples || null,
        dialerUserId: dialerUserId || null,
        campaignPhone: campaignPhone || null,
        campaignEmail: campaignEmail || null,
        campaignCalendarId: campaignCalendarId || null,
        emailSignature: emailSignature || null,
        // Mark onboarding done once the essentials are set (first time only)
        ...(requiredComplete && !integration.onboardingCompletedAt
          ? { onboardingCompletedAt: new Date().toISOString() }
          : {}),
      });
      alert('Settings saved!');
      if (requiredComplete && !integration.onboardingCompletedAt) {
        setIntegration({ ...integration, onboardingCompletedAt: new Date().toISOString() });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!hasPaidPlan) {
    return (
      <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
        <h3 className="text-lg font-black text-slate-900 mb-2 flex items-center gap-2">
          <HiOutlineUserCircle className="text-indigo-500" /> GHL Profile &amp; Campaign
        </h3>
        <p className="text-slate-500 text-sm mb-4">A Sync Plan is required to configure your GHL profile and campaign settings.</p>
        <Link href="/pricing" className="inline-block bg-indigo-600 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-indigo-700 transition-colors">
          Upgrade to Sync Plan
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-slate-200 rounded"></div>
            <div className="h-4 bg-slate-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!integration) {
    return (
      <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
        <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
          <HiOutlineUserCircle className="text-indigo-500" /> GHL Profile &amp; Campaign
        </h3>
        <p className="text-slate-600">Please connect your GoHighLevel account first.</p>
      </div>
    );
  }

  const Check = ({ done, label }: { done: boolean; label: string }) => (
    <span className={`flex items-center gap-1.5 text-xs font-semibold ${done ? 'text-green-600' : 'text-amber-600'}`}>
      <HiOutlineCheckCircle className={done ? 'text-green-500' : 'text-amber-400'} /> {label}
    </span>
  );

  const showSetup = isSetupFlow || !requiredComplete;
  const inputCls = 'w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';

  return (
    <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
      <h3 className="text-lg font-black text-slate-900 mb-2 flex items-center gap-2">
        <HiOutlineUserCircle className="text-indigo-500" /> GHL Profile &amp; Campaign
      </h3>
      <p className="text-slate-500 text-sm mb-6">
        Your identity for outreach plus the GHL resources the app uses. Pulled live from your connected account where possible.
      </p>

      {noPhoneNumbers && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <p className="font-bold text-red-900 mb-1">A phone number is required</p>
          <p className="text-sm text-red-800 mb-3">
            Your GoHighLevel account has no phone number. The app skip-traces and works leads by
            phone, so you must <strong>purchase a phone number in GHL</strong> (Settings → Phone
            Numbers, and complete A2P 10DLC registration) before you can finish setup.
            {' '}<strong>Can&apos;t buy a number?</strong> Your GHL phone system may need to be
            enabled first (Settings → Phone System) — if it says &ldquo;requires configuration,&rdquo;
            contact your provider/agency to activate it. Once you&apos;ve bought a number, click
            below to re-check (or reload this page).
          </p>
          <button
            type="button"
            onClick={refreshPhoneNumbers}
            className="text-sm font-semibold bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            I&apos;ve purchased a number — re-check
          </button>
        </div>
      )}

      {showSetup && (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4">
          <p className="font-bold text-indigo-900 mb-1">Finish connecting your GHL info</p>
          <p className="text-sm text-indigo-800 mb-3">
            These are required for the app to run your outreach and route leads to the right person.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Check done={!!agentName} label="Agent name" />
            <Check done={!!agentBrokerage} label="Brokerage" />
            <Check done={!noPhoneNumbers && !!campaignPhone} label="Phone number" />
            <Check done={!!dialerUserId} label="Assigned user" />
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Agent identity */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Agent Name <span className="text-red-500">*</span>
          </label>
          <input type="text" value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Jane Smith" className={inputCls} />
          <p className="text-xs text-slate-500 mt-1">Your full name as it appears in SMS/email outreach.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Brokerage <span className="text-red-500">*</span>
          </label>
          <input type="text" value={agentBrokerage} onChange={(e) => setAgentBrokerage(e.target.value)} placeholder="Keller Williams" className={inputCls} />
          <p className="text-xs text-slate-500 mt-1">Your brokerage name as it appears in messages.</p>
        </div>

        {/* Assignment (live from GHL) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Assign callable leads to <span className="text-red-500">*</span>
          </label>
          <select value={dialerUserId} onChange={(e) => setDialerUserId(e.target.value)} className={inputCls}>
            <option value="">Select a GHL user…</option>
            {ghlUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name}{u.email ? ` (${u.email})` : ''}</option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Synced leads with a phone are assigned to this GHL user for dialing.{' '}
            {usersError && <span className="text-amber-600">{usersError}</span>}
          </p>
        </div>

        {/* Campaign phone (live from GHL) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Campaign Phone Number</label>
          <select value={campaignPhone} onChange={(e) => setCampaignPhone(e.target.value)} className={inputCls}>
            <option value="">Select a phone number…</option>
            {campaignPhone && !phoneNumbers.some((p) => p.number === campaignPhone) && (
              <option value={campaignPhone}>{campaignPhone} (current)</option>
            )}
            {phoneNumbers.map((p) => (
              <option key={p.number} value={p.number}>{p.number}{p.name ? ` — ${p.name}` : ''}</option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">Phone number used for SMS campaigns.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Campaign Email Address</label>
          <input type="email" value={campaignEmail} onChange={(e) => setCampaignEmail(e.target.value)} placeholder="you@contact.yourdomain.com" className={inputCls} />
          <p className="text-xs text-slate-500 mt-1">From-address for automated campaign emails.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">GHL Calendar</label>
          <select value={campaignCalendarId} onChange={(e) => setCampaignCalendarId(e.target.value)} className={inputCls}>
            <option value="">Select a calendar…</option>
            {campaignCalendarId && !calendars.some((c) => c.id === campaignCalendarId) && (
              <option value={campaignCalendarId}>{campaignCalendarId} (current)</option>
            )}
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">GHL calendar for AI-booked appointments.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Google Calendar Email <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input type="email" value={agentCalendarEmail} onChange={(e) => setAgentCalendarEmail(e.target.value)} placeholder="you@gmail.com" className={inputCls} />
          <p className="text-xs text-slate-500 mt-1">Google Calendar email for AI-booked appointments. Leave blank to skip.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Email Signature (HTML)</label>
          <textarea value={emailSignature} onChange={(e) => setEmailSignature(e.target.value)} rows={5} placeholder="<p>Jane Smith<br>Keller Williams<br>(555) 123-4567</p>" className={`${inputCls} font-mono text-sm`} />
          <p className="text-xs text-slate-500 mt-1">HTML signature appended to automated emails.</p>
        </div>

        {/* AI Voice */}
        <div className="pt-2 border-t border-slate-100">
          <h4 className="text-sm font-black text-slate-900 mb-1 mt-4">AI Voice <span className="text-slate-400 font-normal">(optional)</span></h4>
          <p className="text-xs text-slate-500 mb-4">Shape how the AI sounds when it <strong>replies to leads</strong>. Does not change cold-outreach text.</p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Your Style / Persona</label>
            <textarea value={aiPersona} onChange={(e) => setAiPersona(e.target.value.slice(0, 1000))} rows={4} placeholder="e.g. Warm and casual, never pushy. Short texts, contractions. Never give legal or tax advice." className={inputCls} />
            <p className="text-xs text-slate-500 mt-1">A short guide to your tone and do's/don'ts. {aiPersona.length}/1000 characters.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Example Replies</label>
            <textarea value={aiExamples} onChange={(e) => setAiExamples(e.target.value.slice(0, 2000))} rows={6} placeholder={'Paste 3-5 of your best real replies so the AI can mimic your voice.'} className={`${inputCls} font-mono text-sm`} />
            <p className="text-xs text-slate-500 mt-1">A few real replies the AI should imitate (not copy verbatim). {aiExamples.length}/2000 characters.</p>
          </div>
        </div>

        <button onClick={saveSettings} disabled={saving} className="w-full bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
