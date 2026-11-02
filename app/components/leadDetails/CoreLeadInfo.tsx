// app/components/leadDetails/CoreLeadInfo.tsx

import { useState, useEffect } from 'react';
import { Loader } from '@aws-amplify/ui-react';
import { FiEdit2 } from 'react-icons/fi';
import { type Schema } from '@/amplify/data/resource';
import { NotesSection } from './NotesSection';
import { AddressAutocomplete, ParsedAddress } from '@/app/components/address/AddressAutocomplete';
import { updateLead } from '@/app/utils/aws/data/lead.client';
import { addressesMatch } from '@/app/utils/leadValidation';
import { useToast } from './ToastProvider';

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
  isEditing,
  onEditToggle,
}: CoreLeadInfoProps) {
  const { addToast } = useToast();

  const [formData, setFormData] = useState({
    id: lead.id,
    ownerFirstName: lead.ownerFirstName || '',
    ownerLastName: lead.ownerLastName || '',
    notes: lead.notes || [],
    mailingAddress: lead.mailingAddress || '',
    mailingCity: lead.mailingCity || '',
    mailingState: lead.mailingState || '',
    mailingZip: lead.mailingZip || '',
    adminFirstName: lead.adminFirstName || '',
    adminLastName: lead.adminLastName || '',
    adminAddress: lead.adminAddress || '',
    adminCity: lead.adminCity || '',
    adminState: lead.adminState || '',
    adminZip: lead.adminZip || '',
    leadLabels: lead.leadLabels || [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Dedicated Mailing Address Modal State
  const [showEditMailingModal, setShowEditMailingModal] = useState(false);
  const [selectedMailingAddress, setSelectedMailingAddress] = useState<ParsedAddress | null>(null);
  const [mailStreetInput, setMailStreetInput] = useState('');
  const [mailCityInput, setMailCityInput] = useState('');
  const [mailStateInput, setMailStateInput] = useState('');
  const [mailZipInput, setMailZipInput] = useState('');
  const [isSavingMailing, setIsSavingMailing] = useState(false);

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
        adminFirstName: lead.adminFirstName || '',
        adminLastName: lead.adminLastName || '',
        adminAddress: lead.adminAddress || '',
        adminCity: lead.adminCity || '',
        adminState: lead.adminState || '',
        adminZip: lead.adminZip || '',
        leadLabels: lead.leadLabels || [],
      });
    }
  }, [lead, isEditing, formData.id]);

  const computeAbsenteeUpdate = (
    mailStreet: string | null,
    mailZip: string | null,
    currentLabels: (string | null)[] | null | undefined
  ) => {
    const propStreet = lead.ownerAddress || '';
    const propZip = lead.ownerZip || '';
    const hasMail = Boolean(mailStreet && mailStreet.trim());
    const isSame =
      !hasMail ||
      (addressesMatch(mailStreet, propStreet) &&
        (!mailZip || !propZip || mailZip.trim().slice(0, 5) === propZip.trim().slice(0, 5)));
    const isAbsenteeOwner = !isSame;
    const cleanLabels = (currentLabels || []).filter((l): l is string => Boolean(l));
    const nextLabels = isAbsenteeOwner
      ? cleanLabels.includes('ABSENTEE')
        ? cleanLabels
        : [...cleanLabels, 'ABSENTEE']
      : cleanLabels.filter((l) => l !== 'ABSENTEE');
    return { isAbsenteeOwner, leadLabels: nextLabels };
  };

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

  const openEditMailingModal = () => {
    setSelectedMailingAddress(null);
    setMailStreetInput(lead.mailingAddress || '');
    setMailCityInput(lead.mailingCity || '');
    setMailStateInput(lead.mailingState || '');
    setMailZipInput(lead.mailingZip || '');
    setShowEditMailingModal(true);
  };

  const handleSaveMailingAddress = async () => {
    const street = (selectedMailingAddress?.street || mailStreetInput).trim();
    const city = (selectedMailingAddress?.city || mailCityInput).trim();
    const state = (selectedMailingAddress?.state || mailStateInput).trim();
    const zip = (selectedMailingAddress?.zip || mailZipInput).trim();

    if (!street || !city || !state) {
      addToast({
        type: 'error',
        title: 'Missing fields',
        message: 'Please provide street, city, and state for the mailing address.',
      });
      return;
    }

    setIsSavingMailing(true);
    try {
      const { isAbsenteeOwner, leadLabels } = computeAbsenteeUpdate(
        street,
        zip,
        lead.leadLabels
      );

      const updates: Record<string, any> = {
        mailingAddress: street,
        mailingCity: city,
        mailingState: state,
        mailingZip: zip || null,
        isAbsenteeOwner,
        leadLabels,
      };

      if (lead.type === 'PROBATE') {
        updates.adminAddress = street;
        updates.adminCity = city;
        updates.adminState = state;
        updates.adminZip = zip || null;
      }

      const updatedLead = await updateLead(lead.id, updates);

      onUpdate({
        ...lead,
        ...(updatedLead as Lead),
        mailingAddress: street,
        mailingCity: city,
        mailingState: state,
        mailingZip: zip || null,
        isAbsenteeOwner,
        leadLabels,
        ghlSyncStatus: lead.ghlSyncStatus,
        ghlContactId: lead.ghlContactId,
        ghlSyncDate: lead.ghlSyncDate,
      });

      setShowEditMailingModal(false);
      addToast({
        type: 'success',
        title: 'Mailing address updated',
        message: `${street}, ${city}, ${state} ${zip} saved.`,
      });
    } catch (err: any) {
      console.error('Failed to update mailing address:', err);
      addToast({
        type: 'error',
        title: 'Update failed',
        message: err.message || 'Could not update mailing address.',
      });
    } finally {
      setIsSavingMailing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const mailStreet = formData.mailingAddress.trim() || null;
      const mailCity = formData.mailingCity.trim() || null;
      const mailState = formData.mailingState.trim() || null;
      const mailZip = formData.mailingZip.trim() || null;

      const { isAbsenteeOwner, leadLabels } = computeAbsenteeUpdate(
        mailStreet,
        mailZip,
        formData.leadLabels
      );

      const payload: Record<string, any> = {
        ownerFirstName: formData.ownerFirstName.trim() || null,
        ownerLastName: formData.ownerLastName.trim(),
        notes: formData.notes,
        mailingAddress: mailStreet,
        mailingCity: mailCity,
        mailingState: mailState,
        mailingZip: mailZip,
        isAbsenteeOwner,
        leadLabels,
      };

      if (lead.type === 'PROBATE') {
        payload.adminFirstName = formData.adminFirstName.trim() || null;
        payload.adminLastName = formData.adminLastName.trim() || null;
        payload.adminAddress = formData.adminAddress.trim() || mailStreet;
        payload.adminCity = formData.adminCity.trim() || mailCity;
        payload.adminState = formData.adminState.trim() || mailState;
        payload.adminZip = formData.adminZip.trim() || mailZip;
      }

      const updatedLead = await updateLead(formData.id, payload);

      onUpdate({
        ...lead,
        ...(updatedLead as Lead),
        ...payload,
        ghlSyncStatus: lead.ghlSyncStatus,
        ghlContactId: lead.ghlContactId,
        ghlSyncDate: lead.ghlSyncDate,
      });
      onEditToggle(false);
      addToast({
        type: 'success',
        title: 'Changes saved',
        message: 'Owner & contact details have been updated.',
      });
    } catch (err: any) {
      console.error('Save failed:', err);
      addToast({
        type: 'error',
        title: 'Save failed',
        message: err.message || 'Failed to update lead.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (name: keyof typeof formData, label: string) => {
    const value = formData[name];
    if (Array.isArray(value)) return null;

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
            value={(value as string) || ''}
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

      {/* 👤 ADMIN/EXECUTOR INFO (Probate Only) */}
      {lead.type === 'PROBATE' && (
        <div className='pt-4 border-t border-gray-100'>
          <label className='block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3'>
            👤 Administrator / Executor
          </label>
          <div className='bg-purple-50 p-4 rounded-lg border border-purple-200 space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              {renderField('adminFirstName', 'Admin First Name')}
              {renderField('adminLastName', 'Admin Last Name')}
            </div>
            {isEditing ? (
              <div className='space-y-3 pt-2 border-t border-purple-200/50'>
                {renderField('adminAddress', 'Admin Street Address')}
                <div className='grid grid-cols-3 gap-3'>
                  {renderField('adminCity', 'City')}
                  {renderField('adminState', 'State')}
                  {renderField('adminZip', 'Zip')}
                </div>
              </div>
            ) : (
              (formData.adminAddress || formData.adminCity) && (
                <div>
                  <p className='text-xs text-gray-500 mb-1'>Address</p>
                  <p className='text-base font-medium text-gray-800'>
                    {formData.adminAddress}
                    {formData.adminCity && `, ${formData.adminCity}`}
                    {formData.adminState && `, ${formData.adminState}`}
                    {formData.adminZip && ` ${formData.adminZip}`}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      )}


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
          <div className='flex items-center gap-2'>
            {!isEditing && (
              <button
                type='button'
                onClick={openEditMailingModal}
                className='flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition'
                title='Edit Mailing Address'
              >
                <FiEdit2 className='w-3 h-3' /> Edit Address
              </button>
            )}
            {!isEditing && formData.mailingAddress && (
              <button
                type='button'
                onClick={copyMailingAddress}
                className='text-[10px] px-2 py-1 rounded border bg-gray-50 text-gray-500 hover:bg-gray-100 transition'
              >
                {copied ? 'Copied!' : 'Copy Address'}
              </button>
            )}
          </div>
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
            <div>
              <div className='flex items-center justify-between mb-1'>
                <label className='block text-xs font-bold text-gray-400 uppercase tracking-wider'>
                  Search Mailing Address (Autocomplete)
                </label>
                {lead.ownerAddress && (
                  <button
                    type='button'
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        mailingAddress: lead.ownerAddress || '',
                        mailingCity: lead.ownerCity || '',
                        mailingState: lead.ownerState || '',
                        mailingZip: lead.ownerZip || '',
                      }))
                    }
                    className='text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline'
                  >
                    Use Property Address
                  </button>
                )}
              </div>
              <AddressAutocomplete
                key={`inline-mail-${lead.id}`}
                onSelect={(addr) => {
                  setFormData((prev) => ({
                    ...prev,
                    mailingAddress: addr.street,
                    mailingCity: addr.city,
                    mailingState: addr.state,
                    mailingZip: addr.zip,
                  }));
                }}
                className='w-full'
              />
            </div>
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

      {/* 📬 EDIT MAILING ADDRESS MODAL */}
      {showEditMailingModal && (
        <div className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'>
          <div className='bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150'>
            <div className='flex items-center justify-between border-b pb-3'>
              <div>
                <h3 className='text-lg font-bold text-slate-900'>Edit Mailing Address</h3>
                <p className='text-xs text-slate-500'>
                  Search with Google Places to standardize or edit fields below.
                </p>
              </div>
              <button
                type='button'
                onClick={() => setShowEditMailingModal(false)}
                className='text-slate-400 hover:text-slate-600 text-sm font-bold'
              >
                ✕
              </button>
            </div>

            {lead.mailingAddress && (
              <div className='bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs'>
                <span className='font-bold text-slate-400 uppercase block mb-0.5'>
                  Current Mailing Address
                </span>
                <span className='text-slate-700 font-medium'>
                  {[lead.mailingAddress, lead.mailingCity, lead.mailingState, lead.mailingZip]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}

            <div>
              <div className='flex items-center justify-between mb-1.5'>
                <label className='block text-xs font-bold text-slate-500 uppercase'>
                  Search New Mailing Address
                </label>
                {lead.ownerAddress && (
                  <button
                    type='button'
                    onClick={() => {
                      setSelectedMailingAddress(null);
                      setMailStreetInput(lead.ownerAddress || '');
                      setMailCityInput(lead.ownerCity || '');
                      setMailStateInput(lead.ownerState || '');
                      setMailZipInput(lead.ownerZip || '');
                    }}
                    className='text-xs font-bold text-indigo-600 hover:text-indigo-800 underline'
                  >
                    Same as Property Address
                  </button>
                )}
              </div>
              <AddressAutocomplete
                key={`modal-mail-${lead.id}`}
                onSelect={(addr) => {
                  setSelectedMailingAddress(addr);
                  setMailStreetInput(addr.street);
                  setMailCityInput(addr.city);
                  setMailStateInput(addr.state);
                  setMailZipInput(addr.zip);
                }}
                className='w-full'
              />
              {selectedMailingAddress && (
                <p className='mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md p-2'>
                  ✓{' '}
                  {[
                    selectedMailingAddress.street,
                    selectedMailingAddress.city,
                    selectedMailingAddress.state,
                    selectedMailingAddress.zip,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
            </div>

            <div className='bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3'>
              <div>
                <label className='block text-[10px] font-bold text-slate-500 uppercase mb-1'>
                  Street Address *
                </label>
                <input
                  type='text'
                  value={mailStreetInput}
                  onChange={(e) => {
                    setSelectedMailingAddress(null);
                    setMailStreetInput(e.target.value);
                  }}
                  placeholder='e.g. 105 Mercer Place'
                  className='w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none'
                />
              </div>
              <div className='grid grid-cols-3 gap-2'>
                <div>
                  <label className='block text-[10px] font-bold text-slate-500 uppercase mb-1'>
                    City *
                  </label>
                  <input
                    type='text'
                    value={mailCityInput}
                    onChange={(e) => {
                      setSelectedMailingAddress(null);
                      setMailCityInput(e.target.value);
                    }}
                    placeholder='South Orange'
                    className='w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none'
                  />
                </div>
                <div>
                  <label className='block text-[10px] font-bold text-slate-500 uppercase mb-1'>
                    State *
                  </label>
                  <input
                    type='text'
                    value={mailStateInput}
                    onChange={(e) => {
                      setSelectedMailingAddress(null);
                      setMailStateInput(e.target.value);
                    }}
                    placeholder='NJ'
                    className='w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none'
                  />
                </div>
                <div>
                  <label className='block text-[10px] font-bold text-slate-500 uppercase mb-1'>
                    ZIP Code
                  </label>
                  <input
                    type='text'
                    value={mailZipInput}
                    onChange={(e) => {
                      setSelectedMailingAddress(null);
                      setMailZipInput(e.target.value);
                    }}
                    placeholder='07079'
                    className='w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none'
                  />
                </div>
              </div>
            </div>

            <div className='flex gap-3 pt-2'>
              <button
                type='button'
                onClick={handleSaveMailingAddress}
                disabled={
                  isSavingMailing ||
                  (!selectedMailingAddress &&
                    (!mailStreetInput.trim() || !mailCityInput.trim() || !mailStateInput.trim()))
                }
                className='flex-1 bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition shadow-md'
              >
                {isSavingMailing ? 'Saving...' : 'Save Mailing Address'}
              </button>
              <button
                type='button'
                onClick={() => setShowEditMailingModal(false)}
                disabled={isSavingMailing}
                className='px-4 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
