'use client';

import { useState, useEffect } from 'react';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import { HiOutlineCog6Tooth } from 'react-icons/hi2';
import { useAccess } from '@/app/context/AccessContext';
import Link from 'next/link';

export default function GhlCampaignSettings() {
  const { hasPaidPlan } = useAccess();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState<any>(null);
  const [campaignPhone, setCampaignPhone] = useState('');
  const [campaignEmail, setCampaignEmail] = useState('');
  const [campaignCalendarId, setCampaignCalendarId] = useState('');
  const [emailSignature, setEmailSignature] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const user = await getFrontEndUser();
      if (!user) return;

      const { data: integrations } = await client.models.GhlIntegration.list({
        filter: {
          userId: { eq: user.userId },
          isActive: { eq: true }
        }
      });

      if (integrations && integrations.length > 0) {
        const userIntegration = integrations[0];
        setIntegration(userIntegration);
        setCampaignPhone(userIntegration.campaignPhone || '');
        setCampaignEmail(userIntegration.campaignEmail || '');
        setCampaignCalendarId(userIntegration.campaignCalendarId || '');
        setEmailSignature(userIntegration.emailSignature || '');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!integration) return;

    setSaving(true);
    try {
      await client.models.GhlIntegration.update({
        id: integration.id,
        campaignPhone,
        campaignEmail,
        campaignCalendarId,
        emailSignature
      });

      alert('Settings saved successfully!');
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
          <HiOutlineCog6Tooth className="text-indigo-500" /> Campaign Settings
        </h3>
        <p className="text-slate-500 text-sm mb-4">A Sync Plan is required to configure Launch AI campaign settings.</p>
        <Link
          href="/pricing"
          className="inline-block bg-indigo-600 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
        >
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
          <HiOutlineCog6Tooth className="text-indigo-500" /> Campaign Settings
        </h3>
        <p className="text-slate-600">Please connect your Launch AI system first.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
      <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
        <HiOutlineCog6Tooth className="text-indigo-500" /> Campaign Settings
      </h3>

      <div className="space-y-6">
        {/* Campaign Phone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Campaign Phone Number
          </label>
          <input
            type="tel"
            value={campaignPhone}
            onChange={(e) => setCampaignPhone(e.target.value)}
            placeholder="(732) 810-0182"
            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Phone number for SMS campaigns
          </p>
        </div>

        {/* Campaign Email */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Campaign Email Address
          </label>
          <input
            type="email"
            value={campaignEmail}
            onChange={(e) => setCampaignEmail(e.target.value)}
            placeholder="jose.fernandez@contact.josetherealtor.com"
            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Email address for automated campaigns
          </p>
        </div>

        {/* Campaign Calendar ID */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            GHL Calendar ID
          </label>
          <input
            type="text"
            value={campaignCalendarId}
            onChange={(e) => setCampaignCalendarId(e.target.value)}
            placeholder="tuC1rqAOzPTThWUC7rvS"
            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">
            GHL calendar ID for AI-booked appointments. Find it in GHL under Calendars &rarr; Settings &rarr; Calendar URL.
          </p>
        </div>

        {/* Email Signature */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Email Signature (HTML)
          </label>
          <textarea
            value={emailSignature}
            onChange={(e) => setEmailSignature(e.target.value)}
            rows={6}
            placeholder="<p>Jose Fernandez<br>RE/MAX Homeland Realtors<br>(732) 810-0182</p>"
            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">
            HTML signature for automated emails
          </p>
        </div>

        {/* Save Button */}
        <button
          onClick={saveSettings}
          disabled={saving}
          className="w-full bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
