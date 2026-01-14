// app/components/leadDetails/CoreLeadInfo.tsx

import { useState, useEffect } from 'react';
import { Loader } from '@aws-amplify/ui-react';
import { type Schema } from '@/amplify/data/resource';
import { NotesSection } from './NotesSection';

type Lead = Schema['PropertyLead']['type'] & {
  notes?: Array<{text: string, createdAt: string, createdBy?: string}> | null;
  ghlSyncStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  ghlContactId?: string | null;
  ghlSyncDate?: string | null;
  equityPercent?: number | null;
  estimatedValue?: number | null;
  mortgageBalance?: number | null;
  ownerOccupied?: boolean | null;
  freeAndClear?: boolean | null;
  batchDataEnriched?: boolean | null;
  batchDataEnrichedAt?: string | null;
};

interface CoreLeadInfoProps {
  lead: Lead;
  onUpdate: (updatedLead: Lead) => void;
  client: any;
  isEditing: boolean;
  onEditToggle: (isEditing: boolean) => void;
}

export function CoreLeadInfo({
  lead,
  onUpdate,
  client,
  isEditing,
  onEditToggle,
}: CoreLeadInfoProps) {
  const [formData, setFormData] = useState({
    id: lead.id,
    ownerFirstName: lead.ownerFirstName || '',
    ownerLastName: lead.ownerLastName || '',
    notes: lead.notes || [],
    mailingAddress: lead.mailingAddress || '',
    mailingCity: lead.mailingCity || '',
    mailingState: lead.mailingState || '',
    mailingZip: lead.mailingZip || '',
    leadLabels: lead.leadLabels || [], // 👈 Ensure this is always an array
  });
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isEditing || lead.id !== formData.id) {
      setFormData({
        id: lead.id,
        ownerFirstName: lead.ownerFirstName || '',
        ownerLastName: lead.ownerLastName || '',
        notes: lead.notes || [],
        mailingAddress: lead.mailingAddress || '',
        mailingCity: lead.mailingCity || '',
        mailingState: lead.mailingState || '',
        mailingZip: lead.mailingZip || '',
        leadLabels: lead.leadLabels || [], // 👈 Sync with server data
      });
    }
  }, [lead, isEditing, formData.id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const copyMailingAddress = () => {
    const fullAddress = `${formData.mailingAddress}, ${formData.mailingCity}, ${formData.mailingState} ${formData.mailingZip}`;
    navigator.clipboard.writeText(fullAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        id: formData.id,
        ownerFirstName: formData.ownerFirstName,
        ownerLastName: formData.ownerLastName,
        notes: formData.notes,
        mailingAddress: formData.mailingAddress,
        mailingCity: formData.mailingCity,
        mailingState: formData.mailingState,
        mailingZip: formData.mailingZip,
        leadLabels: formData.leadLabels, // 👈 Explicitly include labels in the update
      };

      const { data: updatedLead, errors } =
        await client.models.PropertyLead.update(payload);

      if (errors || !updatedLead)
        throw new Error(errors?.[0]?.message || 'Failed to update lead.');

      onUpdate({
        ...(updatedLead as Lead),
        ghlSyncStatus: lead.ghlSyncStatus,
        ghlContactId: lead.ghlContactId,
        ghlSyncDate: lead.ghlSyncDate,
      });
      onEditToggle(false);
    } catch (err: any) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (name: keyof typeof formData, label: string) => {
    const value = formData[name];
    if (Array.isArray(value)) return null; // Skip labels array for standard inputs

    const isTextArea = name === 'notes';
    const InputComponent = isTextArea ? 'textarea' : 'input';

    return (
      <div className='w-full'>
        <label className='block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1'>
          {label}
        </label>
        {isEditing ? (
          <InputComponent
            name={name}
            value={value as string}
            onChange={handleChange}
            className='block w-full border border-gray-200 rounded-md p-2 text-sm text-gray-800 focus:ring-indigo-500'
          />
        ) : (
          <p
            className={`text-base text-gray-800 font-medium ${isTextArea ? 'whitespace-pre-wrap' : ''}`}
          >
            {value || (
              <span className='text-gray-300 italic font-normal text-sm'>
                N/A
              </span>
            )}
          </p>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSave} className='space-y-6'>
      <div className='grid grid-cols-2 gap-6'>
        {renderField('ownerFirstName', 'First Name')}
        {renderField('ownerLastName', 'Last Name')}
      </div>

      {/* 🟢 PROSPECTING LABELS DISPLAY */}
      <div className='pt-4 border-t border-gray-100'>
        <label className='block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2'>
          Prospecting Labels
        </label>
        <div className='flex flex-wrap gap-2'>
          {formData.leadLabels && formData.leadLabels.length > 0 ? (
            formData.leadLabels.map((label, idx) => (
              <span
                key={idx}
                className='px-2 py-1 rounded bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wide border border-slate-200 shadow-sm'
              >
                {label?.replace(/_/g, ' ')}
              </span>
            ))
          ) : (
            <span className='text-gray-300 italic text-sm'>
              No labels assigned
            </span>
          )}
        </div>
      </div>

      {/* 🏦 BATCHDATA ENRICHMENT (Preforeclosure Only) */}
      {lead.type === 'PREFORECLOSURE' && lead.batchDataEnriched && (
        <div className='pt-4 border-t border-gray-100'>
          <label className='block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3'>
            🏦 Property Enrichment Data
          </label>
          <div className='grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg border border-blue-200'>
            {/* Equity Info */}
            <div>
              <p className='text-xs text-gray-500 mb-1'>Equity Percentage</p>
              <p className='text-lg font-bold text-blue-900'>
                {lead.equityPercent ? `${lead.equityPercent}%` : 'N/A'}
              </p>
            </div>
            <div>
              <p className='text-xs text-gray-500 mb-1'>Estimated Value</p>
              <p className='text-lg font-bold text-blue-900'>
                {lead.estimatedValue ? `$${lead.estimatedValue.toLocaleString()}` : 'N/A'}
              </p>
            </div>
            <div>
              <p className='text-xs text-gray-500 mb-1'>Mortgage Balance</p>
              <p className='text-lg font-bold text-blue-900'>
                {lead.mortgageBalance ? `$${lead.mortgageBalance.toLocaleString()}` : 'N/A'}
              </p>
            </div>
            <div>
              <p className='text-xs text-gray-500 mb-1'>Property Status</p>
              <div className='flex gap-2 flex-wrap'>
                {lead.ownerOccupied && (
                  <span className='px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded'>
                    Owner Occupied
                  </span>
                )}
                {lead.freeAndClear && (
                  <span className='px-2 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded'>
                    Free & Clear
                  </span>
                )}
                {lead.equityPercent && lead.equityPercent >= 50 && (
                  <span className='px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded'>
                    High Equity
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className='text-xs text-gray-400 mt-2'>
            Enriched on {lead.batchDataEnrichedAt ? new Date(lead.batchDataEnrichedAt).toLocaleDateString() : 'N/A'}
          </p>
        </div>
      )}

      <div className='pt-4 border-t border-gray-100'>
        <div className='flex justify-between items-center mb-3'>
          <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
            Mailing Address
          </label>
          {!isEditing && formData.mailingAddress && (
            <button
              type='button'
              onClick={copyMailingAddress}
              className='text-[10px] px-2 py-1 rounded border bg-gray-50 text-gray-500'
            >
              {copied ? 'Copied!' : 'Copy Address'}
            </button>
          )}
        </div>
        {!isEditing ? (
          <div>
            <p className='text-gray-800 font-medium'>
              {formData.mailingAddress || 'N/A'}
            </p>
            {formData.mailingAddress && (
              <p className='text-sm text-gray-500'>
                {formData.mailingCity}, {formData.mailingState}{' '}
                {formData.mailingZip}
              </p>
            )}
          </div>
        ) : (
          <div className='space-y-3'>
            {renderField('mailingAddress', 'Street')}
            <div className='grid grid-cols-3 gap-3'>
              {renderField('mailingCity', 'City')}
              {renderField('mailingState', 'State')}
              {renderField('mailingZip', 'Zip')}
            </div>
          </div>
        )}
      </div>

      <div className='pt-4 border-t border-gray-100'>
        <NotesSection 
          notes={formData.notes}
          onNotesUpdate={(notes) => setFormData(prev => ({ ...prev, notes }))}
          isEditing={isEditing}
        />
      </div>

      {isEditing && (
        <div className='flex justify-end pt-4'>
          <button
            type='submit'
            disabled={isSaving}
            className='px-6 py-2 text-sm font-bold rounded-md bg-green-600 text-white'
          >
            {isSaving ? <Loader size='small' /> : 'Save Changes'}
          </button>
        </div>
      )}
    </form>
  );
}
