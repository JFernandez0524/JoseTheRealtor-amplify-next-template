import React, { useState, useEffect } from 'react';
import { cookiesClient } from '@/app/utils/aws/auth/amplifyServerUtils.server';

interface EmailTemplateSettingsProps {
  integration: any;
  onUpdate: () => void;
}

export default function EmailTemplateSettings({ integration, onUpdate }: EmailTemplateSettingsProps) {
  const [probateSubject, setProbateSubject] = useState('');
  const [probateTemplate, setProbateTemplate] = useState('');
  const [preforeclosureSubject, setPreforeclosureSubject] = useState('');
  const [preforeclosureTemplate, setPreforeclosureTemplate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (integration) {
      setProbateSubject(integration.probateEmailSubject || 'Two options for {propertyAddress} (Preliminary Analysis)');
      setProbateTemplate(integration.probateEmailTemplate || getDefaultProbateTemplate());
      setPreforeclosureSubject(integration.preforeclosureEmailSubject || 'Two options for {propertyAddress} (Preliminary Analysis)');
      setPreforeclosureTemplate(integration.preforeclosureEmailTemplate || getDefaultPreforeclosureTemplate());
    }
  }, [integration]);

  const getDefaultProbateTemplate = () => `{firstName},

I specialize in helping NJ families navigate the complexity of settling estates. As a partner at The Borrero Group (a Top 10 RE/MAX Team with 751 properties sold), I believe in giving families clear data, not sales pitches.

Based on a preliminary analysis of {propertyAddress}, here are two potential paths for the estate:

AS-IS CASH OFFER: {cashOffer} (Quick close, no repairs, we handle the cleanout)

RETAIL LISTING: {zestimate} (Maximum market value, utilizing our Diamond Award marketing)

We have successfully sold homes ranging from $80k to $5.2 million, so we have the experience to execute either option depending on your goals.

I just need 10 minutes to walk through the property to confirm the condition and firm up these numbers.

Are you open to meeting briefly to discuss which option is best for the family?

Best regards,
Jose Fernandez
Partner, The Borrero Group
RE/MAX Agent`;

  const getDefaultPreforeclosureTemplate = () => `{firstName},

I noticed your property at {propertyAddress} and wanted to reach out with some options that might help your situation.

Based on current market data:

AS-IS CASH OFFER: {cashOffer} (Quick close, no repairs needed)
RETAIL LISTING: {zestimate} (Maximum market value if you have time)

We can close quickly with no repairs needed, or we can help you list it for full market value if you prefer.

Would you be open to a quick conversation about your options?

Best regards,
Jose Fernandez
RE/MAX Agent`;

  const handleSave = async () => {
    setSaving(true);
    try {
      await cookiesClient.models.GhlIntegration.update({
        id: integration.id,
        probateEmailSubject: probateSubject,
        probateEmailTemplate: probateTemplate,
        preforeclosureEmailSubject: preforeclosureSubject,
        preforeclosureEmailTemplate: preforeclosureTemplate,
      });
      onUpdate();
      alert('Email templates saved successfully!');
    } catch (error) {
      console.error('Failed to save templates:', error);
      alert('Failed to save templates. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">📧 Email Templates</h3>
      
      {/* Probate Template */}
      <div className="mb-6">
        <h4 className="font-medium mb-2">Probate Leads</h4>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Subject Line</label>
          <input
            type="text"
            value={probateSubject}
            onChange={(e) => setProbateSubject(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Email subject for probate leads"
          />
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Email Template</label>
          <textarea
            value={probateTemplate}
            onChange={(e) => setProbateTemplate(e.target.value)}
            rows={12}
            className="w-full p-2 border rounded font-mono text-sm"
            placeholder="Email template for probate leads"
          />
        </div>
      </div>

      {/* Preforeclosure Template */}
      <div className="mb-6">
        <h4 className="font-medium mb-2">Preforeclosure Leads</h4>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Subject Line</label>
          <input
            type="text"
            value={preforeclosureSubject}
            onChange={(e) => setPreforeclosureSubject(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Email subject for preforeclosure leads"
          />
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Email Template</label>
          <textarea
            value={preforeclosureTemplate}
            onChange={(e) => setPreforeclosureTemplate(e.target.value)}
            rows={10}
            className="w-full p-2 border rounded font-mono text-sm"
            placeholder="Email template for preforeclosure leads"
          />
        </div>
      </div>

      {/* Variables Help */}
      <div className="mb-4 p-3 bg-gray-50 rounded">
        <p className="text-sm font-medium mb-2">Available Variables:</p>
        <div className="text-xs text-gray-600 grid grid-cols-2 gap-2">
          <span><code>{'{firstName}'}</code> - Contact's first name</span>
          <span><code>{'{propertyAddress}'}</code> - Property address</span>
          <span><code>{'{zestimate}'}</code> - Formatted market value</span>
          <span><code>{'{cashOffer}'}</code> - Formatted cash offer (70%)</span>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Templates'}
      </button>
    </div>
  );
}
