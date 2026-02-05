'use client';

import React, { useState, useEffect, useRef } from 'react';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { type Schema } from '@/amplify/data/resource';

interface EmailTemplateSettingsProps {
  integration: any;
  onUpdate: () => void;
}

interface FieldOption {
  label: string;
  value: string;
  description: string;
}

const AVAILABLE_FIELDS: FieldOption[] = [
  { label: 'First Name', value: '{firstName}', description: "Contact's first name" },
  { label: 'Property Address', value: '{propertyAddress}', description: 'Full property address' },
  { label: 'Market Value', value: '{zestimate}', description: 'Formatted Zestimate value' },
  { label: 'Cash Offer', value: '{cashOffer}', description: 'Formatted cash offer (70% of value)' },
];

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
}

function TemplateEditor({ value, onChange, placeholder, rows = 10 }: TemplateEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertField = (field: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.substring(0, start) + field + value.substring(end);
    
    onChange(newValue);
    
    // Set cursor position after inserted field
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + field.length, start + field.length);
    }, 0);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 mb-2">
        {AVAILABLE_FIELDS.map((field) => (
          <button
            key={field.value}
            type="button"
            onClick={() => insertField(field.value)}
            className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded border"
            title={field.description}
          >
            + {field.label}
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full p-3 border rounded font-mono text-sm resize-y"
        placeholder={placeholder}
      />
    </div>
  );
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
      await client.models.GhlIntegration.update({
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
          <TemplateEditor
            value={probateTemplate}
            onChange={setProbateTemplate}
            placeholder="Email template for probate leads"
            rows={12}
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
          <TemplateEditor
            value={preforeclosureTemplate}
            onChange={setPreforeclosureTemplate}
            placeholder="Email template for preforeclosure leads"
            rows={10}
          />
        </div>
      </div>

      {/* Variables Help */}
      <div className="mb-4 p-3 bg-gray-50 rounded">
        <p className="text-sm font-medium mb-2">💡 How to use:</p>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Click the blue buttons above each editor to insert database fields</li>
          <li>• Fields will be replaced with actual data when emails are sent</li>
          <li>• You can type additional variables manually using {'{fieldName}'} format</li>
          <li>• Preview your template by checking recent sent emails in GHL</li>
        </ul>
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
