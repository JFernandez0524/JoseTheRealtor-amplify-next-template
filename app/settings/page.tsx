'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState<any>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [emailSignature, setEmailSignature] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const user = await getFrontEndUser();
      if (!user) {
        router.push('/');
        return;
      }

      // Get GHL integration
      const { data: integrations } = await client.models.GhlIntegration.list({
        filter: {
          userId: { eq: user.userId },
          isActive: { eq: true }
        }
      });

      if (!integrations || integrations.length === 0) {
        alert('Please connect your GHL account first');
        router.push('/profile');
        return;
      }

      const userIntegration = integrations[0];
      setIntegration(userIntegration);
      setSelectedPhone(userIntegration.selectedPhoneNumber || '');
      setSelectedEmail(userIntegration.selectedEmail || '');
      setEmailSignature(userIntegration.emailSignature || '');

      // Fetch available phone numbers from GHL
      try {
        const response = await fetch('/api/v1/ghl-phone-numbers');
        const data = await response.json();
        
        if (data.success) {
          setPhoneNumbers(data.phoneNumbers);
        } else {
          console.error('Failed to fetch phone numbers:', data.error);
        }
      } catch (phoneError) {
        console.error('Error fetching phone numbers:', phoneError);
      }

    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!integration) return;

    setSaving(true);
    try {
      await client.models.GhlIntegration.update({
        id: integration.id,
        selectedPhoneNumber: selectedPhone,
        selectedEmail: selectedEmail,
        emailSignature: emailSignature
      });

      alert('✅ Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/profile')}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2"
          >
            ← Back to Profile
          </button>
          <h1 className="text-3xl font-bold text-gray-900">GHL Integration Settings</h1>
          <p className="text-gray-600 mt-2">Configure your GoHighLevel campaign settings</p>
        </div>

        {/* Settings Card */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          
          {/* Phone Number Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Campaign Phone Number
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Select which phone number to use for SMS campaigns. This number will be used for all automated text messages.
            </p>
            <select
              value={selectedPhone}
              onChange={(e) => setSelectedPhone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Select Phone Number --</option>
              {phoneNumbers.map((phone) => (
                <option key={phone.number} value={phone.number}>
                  {phone.number} {phone.isDefault && '(Default)'} {phone.name && `- ${phone.name}`}
                </option>
              ))}
            </select>
          </div>

          {/* Email Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Campaign Email Address
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Enter the email address to use for email campaigns. This should be verified in your GHL account.
            </p>
            <input
              type="email"
              value={selectedEmail}
              onChange={(e) => setSelectedEmail(e.target.value)}
              placeholder="jose.fernandez@josetherealtor.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Email Signature */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email Signature (HTML)
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Paste your GHL email signature HTML here. This will be appended to all automated emails.
            </p>
            <textarea
              value={emailSignature}
              onChange={(e) => setEmailSignature(e.target.value)}
              placeholder="<table>...</table>"
              rows={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">
              💡 Tip: Copy your signature HTML from GHL Settings → Email → Signature
            </p>
          </div>

          {/* Connection Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Connected Location</h3>
            <p className="text-sm text-blue-700">
              Location ID: <span className="font-mono">{integration?.locationId}</span>
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => router.push('/profile')}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !selectedPhone}
              className={`px-6 py-2 rounded-lg text-white font-medium ${
                saving || !selectedPhone
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-900 mb-2">💡 Tips</h3>
          <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
            <li>Phone number must be active in your GHL account</li>
            <li>Email address must be verified in GHL for sending</li>
            <li>Changes take effect immediately for new campaigns</li>
            <li>Existing campaigns will continue using their original settings</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
