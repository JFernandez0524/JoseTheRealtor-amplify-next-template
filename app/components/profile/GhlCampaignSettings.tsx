'use client';

import { useState, useEffect } from 'react';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import { HiOutlineCog6Tooth } from 'react-icons/hi2';

export default function GhlCampaignSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState<any>(null);
  const [campaignPhone, setCampaignPhone] = useState('');
  const [campaignEmail, setCampaignEmail] = useState('');
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
        <p className="text-slate-600">Please connect your GHL account first.</p>
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
