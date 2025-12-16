// app/components/leadDetails/CoreLeadInfo.tsx

import { useState, useEffect } from 'react';
import { Loader } from '@aws-amplify/ui-react';
import { type Schema } from '@/amplify/data/resource';

// Define the shape of our Lead based on the Schema (Extended for custom/backend fields)
type Lead = Schema['PropertyLead']['type'] & {
  notes?: string | null;
  ghlSyncStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  ghlContactId?: string | null;
  ghlSyncDate?: string | null;
};

interface CoreLeadInfoProps {
  lead: Lead;
  onUpdate: (updatedLead: Lead) => void;
  client: any; // Use 'any' for the Amplify client
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
    // 💥 FIX 1: Include the immutable 'id' in the local state
    id: lead.id,
    ownerFirstName: lead.ownerFirstName || '',
    ownerLastName: lead.ownerLastName || '',
    notes: lead.notes || '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // 💥 FIX 2: Sync formData when the lead context changes (based on ID) or when edit mode is toggled.
  useEffect(() => {
    // Reset internal state to prop values when:
    // 1. The lead ID changes (navigating to a new lead).
    // 2. The component exits edit mode (isEditing becomes false).
    if (!isEditing || lead.id !== formData.id) {
      setFormData({
        id: lead.id,
        ownerFirstName: lead.ownerFirstName || '',
        ownerLastName: lead.ownerLastName || '',
        notes: lead.notes || '',
      });
    }
    // 💥 FIX 3: Include all necessary dependencies in the array
  }, [lead, isEditing, formData.id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Include 'id' from the formData state, which originates from the lead prop.
      const payload = {
        id: formData.id,
        ownerFirstName: formData.ownerFirstName,
        ownerLastName: formData.ownerLastName,
        notes: formData.notes,
      };

      const { data: updatedLead, errors } =
        await client.models.PropertyLead.update(payload);

      if (errors || !updatedLead) {
        throw new Error(errors?.[0]?.message || 'Failed to update lead.');
      }

      // Merge existing state and GHL status fields back into the updated lead object
      const finalUpdatedLead: Lead = {
        ...(updatedLead as Lead),
        ghlSyncStatus: lead.ghlSyncStatus,
        ghlContactId: lead.ghlContactId,
        ghlSyncDate: lead.ghlSyncDate,
      };

      onUpdate(finalUpdatedLead);
      onEditToggle(false); // Close edit mode
      alert('Lead saved successfully!');
    } catch (err: any) {
      console.error('Save failed:', err);
      alert(`Save failed: ${err.message || 'Check console.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render Logic for Fields (Read-Only vs. Editable) ---
  const renderField = (
    name: keyof Omit<typeof formData, 'id'>,
    label: string
  ) => {
    const value = formData[name];
    const isTextArea = name === 'notes';
    const InputComponent = isTextArea ? 'textarea' : 'input';

    return (
      <div>
        <label className='block text-sm font-medium text-gray-500'>
          {label}
        </label>
        {isEditing ? (
          <InputComponent
            name={name}
            value={value}
            onChange={handleChange}
            rows={isTextArea ? 3 : 1}
            className='mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-800'
          />
        ) : (
          <p
            className={`text-base text-gray-800 ${isTextArea ? 'whitespace-pre-wrap' : ''}`}
          >
            {value || <span className='text-gray-400 italic'>N/A</span>}
          </p>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSave} className='space-y-6'>
      <div className='grid grid-cols-2 gap-4'>
        {renderField('ownerFirstName', 'First Name')}
        {renderField('ownerLastName', 'Last Name')}
      </div>

      {renderField('notes', 'Notes')}

      {/* Save button only appears in edit mode */}
      {isEditing && (
        <div className='flex justify-end pt-4'>
          <button
            type='submit'
            disabled={isSaving}
            className={`px-4 py-2 text-sm font-medium rounded-md shadow-sm flex items-center gap-2 transition-colors ${
              isSaving
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isSaving ? (
              <>
                <Loader size='small' variation='linear' /> Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      )}
    </form>
  );
}
