// app/components/LeadForm.tsx

import { useState } from 'react';
import { Loader } from '@aws-amplify/ui-react';
import { type Schema } from '@/amplify/data/resource';

// Define the shape of our Lead based on the Schema (Extended for GHL status)
type Lead = Schema['PropertyLead']['type'] & {
  ghlSyncStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  ghlContactId?: string | null;
  ghlSyncDate?: string | null;
};

interface LeadFormProps {
  lead: Lead;
  onUpdate: (updatedLead: Lead) => void;
  client: any; // Use 'any' for the Amplify client
}

export function LeadForm({ lead, onUpdate, client }: LeadFormProps) {
  const [formData, setFormData] = useState({
    ownerFirstName: lead.ownerFirstName || '',
    ownerLastName: lead.ownerLastName || '',
    // Include other editable fields
    notes: lead.notes || '',
  });
  const [isSaving, setIsSaving] = useState(false);

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
      // Only send fields that might have changed, plus the required ID
      const payload = {
        id: lead.id,
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
      alert('Lead saved successfully!');
    } catch (err: any) {
      console.error('Save failed:', err);
      alert(`Save failed: ${err.message || 'Check console.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className='bg-white shadow border rounded-lg p-6'>
      <h2 className='text-xl font-semibold mb-4'>
        Core Lead Information (Editable)
      </h2>
      <form onSubmit={handleSave} className='space-y-6'>
        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700'>
              First Name
            </label>
            <input
              type='text'
              name='ownerFirstName'
              value={formData.ownerFirstName}
              onChange={handleChange}
              className='mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700'>
              Last Name
            </label>
            <input
              type='text'
              name='ownerLastName'
              value={formData.ownerLastName}
              onChange={handleChange}
              className='mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2'
            />
          </div>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700'>
            Notes
          </label>
          <textarea
            name='notes'
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className='mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 resize-none'
          />
        </div>

        <div className='flex justify-end'>
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
      </form>
    </div>
  );
}
