'use client';

import { useState, useRef, useEffect } from 'react';
import { uploadData } from 'aws-amplify/storage';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { useRouter } from 'next/navigation';
import { useAccess } from '@/app/context/AccessContext';
import { HiLockClosed } from 'react-icons/hi';
import { UploadProgressModal } from './UploadProgressModal';
import { fetchLeads } from '@/app/utils/aws/data/lead.client';

interface CsvPreview {
  rowCount: number;
  duplicateCount: number;
  loading: boolean;
}

// 🎯 CSV Template Headers matching your updated Probate file requirements
const PROBATE_TEMPLATE =
  'OWNERSHIP,ownerAddress,ownerCity,ownerState,ownerZip,adminFirstName,adminLastName,adminAddress,adminCity,adminState,adminZip,phone';
const PREFORECLOSURE_TEMPLATE =
  'ownerFirstName,ownerLastName,ownerAddress,ownerCity,ownerState,ownerZip';

export function ManualLeadForm() {
  const { hasPaidPlan, isAdmin } = useAccess();
  const canUsePremium = hasPaidPlan || isAdmin;

  const router = useRouter();
  const [mode, setMode] = useState<'csv' | 'manual'>('manual');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadJobId, setUploadJobId] = useState<string | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [lead, setLead] = useState<any>({
    type: '',
    ownerFirstName: '',
    ownerLastName: '',
    adminFirstName: '',
    adminLastName: '',
    phone: '',
  });

  const ownerContainerRef = useRef<HTMLDivElement>(null);
  const adminContainerRef = useRef<HTMLDivElement>(null);
  const ownerAddressRef = useRef<string>('');
  const adminAddressRef = useRef<string>('');

  const parseFilePreview = async (selectedFile: File) => {
    setCsvPreview({ rowCount: 0, duplicateCount: 0, loading: true });
    try {
      const text = await selectedFile.text();
      const lines = text.trim().split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        setCsvPreview({ rowCount: 0, duplicateCount: 0, loading: false });
        return;
      }
      const rowCount = lines.length - 1;

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const addrIdx = headers.indexOf('owneraddress');
      const zipIdx = headers.indexOf('ownerzip');

      if (addrIdx === -1 || zipIdx === -1) {
        setCsvPreview({ rowCount, duplicateCount: 0, loading: false });
        return;
      }

      const csvKeys = new Set<string>();
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const addr = (cols[addrIdx] || '').trim().toLowerCase();
        const zip = (cols[zipIdx] || '').trim().replace(/\D/g, '').slice(0, 5);
        if (addr && zip) csvKeys.add(`${addr}|${zip}`);
      }

      const existingLeads = await fetchLeads();
      const existingKeys = new Set(
        existingLeads.map(l =>
          `${(l.ownerAddress || '').trim().toLowerCase()}|${(l.ownerZip || '').trim().replace(/\D/g, '').slice(0, 5)}`
        )
      );

      let duplicateCount = 0;
      for (const key of csvKeys) {
        if (existingKeys.has(key)) duplicateCount++;
      }

      setCsvPreview({ rowCount, duplicateCount, loading: false });
    } catch {
      setCsvPreview({ rowCount: 0, duplicateCount: 0, loading: false });
    }
  };

  const downloadTemplate = () => {
    if (!lead.type) return alert('Please select a Lead Type first.');
    const csvContent =
      lead.type === 'PROBATE' ? PROBATE_TEMPLATE : PREFORECLOSURE_TEMPLATE;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lead.type.toLowerCase()}-lead-template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Initialize PlaceAutocompleteElement (new Places API) once Maps loads.
  // Retries every 200ms — PlaceAutocompleteElement requires Places API (New) enabled in GCP.
  useEffect(() => {
    if (mode !== 'manual') return;

    let cancelled = false;
    let retries = 0;

    const init = async () => {
      if (cancelled) return;
      const G = (window as any).google?.maps?.places;
      if (!G?.PlaceAutocompleteElement) {
        if (retries++ < 50) setTimeout(init, 200);
        return;
      }

      if (ownerContainerRef.current && !ownerContainerRef.current.hasChildNodes()) {
        const el = new G.PlaceAutocompleteElement({
          includedRegionCodes: ['us'],
        });
        ownerContainerRef.current.appendChild(el);
        el.addEventListener('gmp-select', async (event: any) => {
          const place = event.placePrediction.toPlace();
          await place.fetchFields({ fields: ['formattedAddress', 'addressComponents', 'location'] });
          ownerAddressRef.current = place.formattedAddress ?? '';
          try {
            const comps: Record<string, string> = {};
            place.addressComponents?.forEach((c: any) => { comps[c.types[0]] = c.longText; });
            const res = await fetch('/api/v1/enrich-manual-lead', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                address: `${comps.street_number ?? ''} ${comps.route ?? ''}`.trim(),
                city: comps.locality || comps.administrative_area_level_2 || '',
                state: comps.administrative_area_level_1 || '',
                zip: comps.postal_code || '',
              }),
            });
            const data = await res.json();
            if (data.success) setMessage(`✅ Address validated. Zestimate: ${data.zestimate ? `$${data.zestimate.toLocaleString()}` : 'N/A'}`);
          } catch {}
        });
      }

      if (adminContainerRef.current && !adminContainerRef.current.hasChildNodes()) {
        const el = new G.PlaceAutocompleteElement({
          includedRegionCodes: ['us'],
        });
        adminContainerRef.current.appendChild(el);
        el.addEventListener('gmp-select', async (event: any) => {
          const place = event.placePrediction.toPlace();
          await place.fetchFields({ fields: ['formattedAddress'] });
          adminAddressRef.current = place.formattedAddress ?? '';
        });
      }
    };

    if (!(window as any).google?.maps) {
      if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`;
        script.async = true;
        document.head.appendChild(script);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [mode, lead.type]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const rawAddress = ownerAddressRef.current.trim();
    const rawAdminAddress = adminAddressRef.current.trim();

    if (!lead.type) return setMessage('❌ Missing: Lead Type');
    if (!lead.ownerLastName) return setMessage('❌ Missing: Last Name');
    if (!rawAddress) return setMessage('❌ Missing: Property Address — please select from the dropdown');
    if (lead.type === 'PROBATE') {
      if (!lead.adminFirstName) return setMessage('❌ Missing: Admin First Name');
      if (!lead.adminLastName) return setMessage('❌ Missing: Admin Last Name');
      if (!rawAdminAddress) return setMessage('❌ Missing: Admin Address — please select from the dropdown');
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/create-manual-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: lead.type,
          ownerFirstName: lead.ownerFirstName || null,
          ownerLastName: lead.ownerLastName,
          phone: lead.phone || null,
          rawAddress,
          adminFirstName: lead.adminFirstName || null,
          adminLastName: lead.adminLastName || null,
          rawAdminAddress: rawAdminAddress || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create lead');

      setMessage('✅ Lead added successfully!');
      ownerAddressRef.current = '';
      adminAddressRef.current = '';
      setLead({ type: '', ownerFirstName: '', ownerLastName: '', adminFirstName: '', adminLastName: '', phone: '' });
    } catch (err: any) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCsvSubmit = async () => {
    if (!file || !lead.type) return setMessage('❌ Select file and lead type.');

    if (!canUsePremium) {
      return setMessage('❌ Bulk CSV Import requires a PRO membership.');
    }

    // Enforce row cap before uploading — Lambda rejects oversized files but this gives faster feedback
    const MAX_ROWS = 500;
    if (csvPreview && !csvPreview.loading && csvPreview.rowCount > MAX_ROWS) {
      return setMessage(`❌ File too large (${csvPreview.rowCount} rows). Maximum is ${MAX_ROWS} per upload. Split the file and upload in batches.`);
    }

    setLoading(true);
    try {
      const user = await getFrontEndUser();
      if (!user) throw new Error('Session expired.');

      // Unique filename prevents S3 collision if same file is re-uploaded
      const uploadFileName = `${Date.now()}-${file.name}`;

      // Create job record first
      const { data: newJob, errors } = await client.models.CsvUploadJob.create({
        userId: user.userId,
        fileName: uploadFileName,
        leadType: lead.type.toUpperCase(),
        status: 'PENDING',
        totalRows: 0,
        processedRows: 0,
        successCount: 0,
        duplicateCount: 0,
        errorCount: 0,
        startedAt: new Date().toISOString(),
      });

      if (errors || !newJob) {
        throw new Error('Failed to create upload job');
      }

      // Wait for DynamoDB consistency (1000ms)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Upload file to S3 (triggers Lambda)
      await uploadData({
        path: `leadFiles/${user.userId}/${uploadFileName}`,
        data: file,
        options: {
          metadata: {
            leadtype: lead.type.toUpperCase(),
            owner_sub: user.userId, // 🔑 Essential for S3 Lambda Guard
          },
        },
      }).result;

      // Show progress modal
      setUploadJobId(newJob.id);
      setShowProgressModal(true);
    } catch (err: any) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='space-y-6 max-w-2xl mx-auto p-4 bg-white shadow-sm rounded-lg'>
      <div className='flex gap-4 border-b border-gray-100 pb-4'>
        <button
          onClick={() => setMode('manual')}
          className={`pb-2 px-4 transition-all ${mode === 'manual' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Manual Add
        </button>
        <button
          onClick={() => setMode('csv')}
          className={`relative pb-2 px-4 transition-all ${mode === 'csv' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <span className='flex items-center gap-2'>
            CSV Import{' '}
            {!canUsePremium && (
              <HiLockClosed className='text-gray-300 w-3 h-3' />
            )}
          </span>
        </button>
      </div>

      {mode === 'csv' ? (
        <div className='space-y-4 animate-in fade-in duration-300'>
          {!canUsePremium && (
            <div className='bg-amber-50 border border-amber-200 p-4 rounded-md mb-4 text-center'>
              <p className='text-amber-800 text-sm font-medium'>
                Bulk CSV uploads are available for <strong>PRO</strong> members
                only.
              </p>
              <button
                onClick={() => router.push('/pricing')}
                className='text-xs text-amber-900 underline font-bold mt-1'
              >
                Upgrade your account
              </button>
            </div>
          )}

          <div
            className={`space-y-4 ${!canUsePremium ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className='bg-gray-50 p-4 rounded-md border border-gray-100'>
              <label className='block text-xs font-bold text-gray-500 uppercase mb-2'>
                1. Select Lead Type
              </label>
              <select
                value={lead.type}
                onChange={(e) => {
                  setLead({ ...lead, type: e.target.value });
                  setCsvPreview(null);
                }}
                className='w-full border p-2 rounded bg-white outline-none focus:ring-2 focus:ring-blue-100'
              >
                <option value=''>Select Type</option>
                <option value='PROBATE'>Probate</option>
                <option value='PREFORECLOSURE'>Pre-Foreclosure</option>
              </select>

              {lead.type && (
                <div className='mt-3 p-3 bg-blue-50 border border-blue-100 rounded text-sm'>
                  <p className='text-blue-800 mb-1'>
                    Format required for <strong>{lead.type}</strong>:
                  </p>
                  <button
                    onClick={downloadTemplate}
                    className='text-blue-600 font-bold hover:underline'
                  >
                    Download {lead.type} Template{' '}
                    {lead.type === 'PROBATE' && '(includes phone column)'}
                  </button>
                </div>
              )}
            </div>

            <div className='p-4 border border-dashed border-gray-300 rounded-md text-center'>
              <label className='block text-xs font-bold text-gray-500 uppercase mb-2 text-left'>
                2. Upload File
              </label>
              <input
                type='file'
                accept='.csv'
                onChange={(e) => {
                  const selected = e.target.files?.[0] || null;
                  setFile(selected);
                  setCsvPreview(null);
                  if (selected) parseFilePreview(selected);
                }}
                className='w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'
              />

              {csvPreview && (
                <div className='mt-3 text-left space-y-2'>
                  {csvPreview.loading ? (
                    <p className='text-xs text-gray-500 flex items-center gap-2'>
                      <span className='inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin' />
                      Checking for duplicates...
                    </p>
                  ) : csvPreview.rowCount > 500 ? (
                    <p className='text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2'>
                      ❌ <strong>{csvPreview.rowCount}</strong> rows — exceeds 500-row limit. Split into smaller files.
                    </p>
                  ) : csvPreview.duplicateCount > 0 ? (
                    <p className='text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2'>
                      📄 <strong>{csvPreview.rowCount}</strong> leads found &nbsp;·&nbsp;
                      ⚠️ <strong>{csvPreview.duplicateCount}</strong> already in your account — they will be skipped
                    </p>
                  ) : (
                    <p className='text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2'>
                      ✅ <strong>{csvPreview.rowCount}</strong> leads found, ready to import
                    </p>
                  )}
                  {!csvPreview.loading && csvPreview.rowCount > 100 && csvPreview.rowCount <= 500 && (
                    <p className='text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-3 py-2'>
                      ⏱ Large batch — estimated processing time: {Math.ceil(csvPreview.rowCount * 0.7 / 60)} – {Math.ceil(csvPreview.rowCount * 1.0 / 60)} minutes
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleCsvSubmit}
              disabled={loading || !file || !lead.type || !canUsePremium}
              className='w-full bg-blue-600 text-white p-3 rounded-md font-bold disabled:bg-gray-300 hover:bg-blue-700 transition-colors'
            >
              {loading ? 'Processing...' : 'Start CSV Import'}
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleManualSubmit}
          className='space-y-4 animate-in fade-in duration-300'
        >
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='text-xs font-bold text-gray-400 uppercase'>
                First Name
              </label>
              <input
                className='w-full border p-2 rounded'
                value={lead.ownerFirstName}
                onChange={(e) =>
                  setLead({ ...lead, ownerFirstName: e.target.value })
                }
              />
            </div>
            <div>
              <label className='text-xs font-bold text-gray-400 uppercase'>
                Last Name *
              </label>
              <input
                className='w-full border p-2 rounded'
                value={lead.ownerLastName}
                onChange={(e) =>
                  setLead({ ...lead, ownerLastName: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className='space-y-1'>
            <label className='text-xs font-bold text-gray-400 uppercase'>
              Phone Number (Optional)
            </label>
            <input
              placeholder='+12015551234'
              className='w-full border p-2 rounded'
              value={lead.phone}
              onChange={(e) => setLead({ ...lead, phone: e.target.value })}
            />
            <p className='text-[10px] text-gray-400'>
              Adding a phone number will skip automated skiptracing.
            </p>
          </div>

          <div className='space-y-1'>
            <label className='text-xs font-bold text-gray-400 uppercase'>
              Lead Type *
            </label>
            <select
              value={lead.type || ''}
              onChange={(e) => setLead({ ...lead, type: e.target.value })}
              className='border p-2 w-full rounded'
              required
            >
              <option value=''>Select Type</option>
              <option value='PROBATE'>Probate</option>
              <option value='PREFORECLOSURE'>Pre-Foreclosure</option>
            </select>
          </div>

          <div className='space-y-1'>
            <label className='text-xs font-bold text-gray-400 uppercase'>
              Property Address *
            </label>
            <div ref={ownerContainerRef} className='border rounded overflow-hidden' />
          </div>

          {lead.type === 'PROBATE' && (
            <div className='p-4 bg-gray-50 rounded-md border border-gray-100 space-y-4'>
              <h3 className='text-sm font-bold text-gray-700 border-b pb-2'>
                Admin / Executor Info
              </h3>
              <div className='grid grid-cols-2 gap-4'>
                <input
                  placeholder='Admin First Name'
                  className='border p-2 rounded bg-white'
                  value={lead.adminFirstName}
                  onChange={(e) =>
                    setLead({ ...lead, adminFirstName: e.target.value })
                  }
                />
                <input
                  placeholder='Admin Last Name'
                  className='border p-2 rounded bg-white'
                  value={lead.adminLastName}
                  onChange={(e) =>
                    setLead({ ...lead, adminLastName: e.target.value })
                  }
                />
              </div>
              <div ref={adminContainerRef} className='border rounded overflow-hidden' />
            </div>
          )}

          <button
            type='submit'
            disabled={loading}
            className='w-full bg-blue-600 text-white p-3 rounded-md font-bold hover:bg-blue-700 disabled:bg-gray-300 transition-colors'
          >
            {loading ? 'Adding...' : 'Save Manual Lead'}
          </button>
        </form>
      )}

      {message && (
        <div
          className={`p-3 rounded text-center text-sm font-bold ${message.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
        >
          {message}
        </div>
      )}
      
      {/* Upload Progress Modal */}
      {showProgressModal && uploadJobId && (
        <UploadProgressModal jobId={uploadJobId} />
      )}
    </div>
  );
}
