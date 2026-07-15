'use client';

import { useState, useRef, useEffect } from 'react';
import { parse as parseCsvSync } from 'csv-parse/browser/esm/sync';
import { uploadData } from 'aws-amplify/storage';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { useRouter } from 'next/navigation';
import { useAccess } from '@/app/context/AccessContext';
import { HiLockClosed } from 'react-icons/hi';
import { UploadProgressModal } from './UploadProgressModal';
import { fetchLeads } from '@/app/utils/aws/data/lead.client';
import { AddressAutocomplete, ParsedAddress } from '@/app/components/address/AddressAutocomplete';
import { sanitizeName, isValidName, formatPhoneE164, sanitizePhoneInput, NAME_MAX } from '@/app/utils/leadValidation';
import { canonicalFields, autoDetectMapping, missingRequired, type LeadType } from '@/app/utils/csvMapping';
import { asJson } from '@/app/utils/batchdata/enrichment';

interface CsvPreview {
  rowCount: number;
  duplicateCount: number;
  loading: boolean;
}

// 🎯 CSV Template Headers matching your updated Probate file requirements
const PROBATE_TEMPLATE =
  'OWNERSHIP,ownerAddress,ownerCity,ownerState,ownerZip,adminFirstName,adminLastName,adminAddress,adminCity,adminState,adminZip,phone';
// Pre-foreclosure template mirrors the county-clerk file: a single borrowerName column (entities like
// LLCs/trusts are auto-detected) plus the authoritative foreclosure fields (recording date, case
// number, lender/plaintiff, trustee, loan amount). ownerFirstName/ownerLastName are still accepted by
// the importer for older files.
const PREFORECLOSURE_TEMPLATE =
  'borrowerName,ownerAddress,ownerCity,ownerState,ownerZip,recordingDate,caseNumber,lender,trustee,loanAmount';

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
  // Whether a file is being dragged over the dropzone (drives the highlight style).
  const [isDragging, setIsDragging] = useState(false);
  // Column mapping (bulk CSV): the uploaded file's header row + the user's field→column choices.
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [lead, setLead] = useState<any>({
    type: '',
    ownerFirstName: '',
    ownerLastName: '',
    adminFirstName: '',
    adminLastName: '',
    phone: '',
  });

  const [leadCreated, setLeadCreated] = useState(false);
  // Bump to remount the AddressAutocomplete widgets (clears their inputs) when starting a new lead.
  const [autocompleteKey, setAutocompleteKey] = useState(0);

  const ownerAddressRef = useRef<ParsedAddress | null>(null);
  const adminAddressRef = useRef<ParsedAddress | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /** Accept a CSV chosen via the file input or dropped on the dropzone: set state + kick off preview/header parsing. */
  const handleFileSelected = (selected: File | null) => {
    if (selected && !/\.csv$/i.test(selected.name)) {
      setMessage('❌ Only .csv files are supported.');
      return;
    }
    setMessage('');
    setFile(selected);
    setCsvPreview(null);
    setSourceHeaders([]);
    if (selected) {
      parseFilePreview(selected);
      readHeaders(selected);
    }
  };

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

  // Read just the header row of the chosen CSV (robust parse, same options the Lambda uses) so the
  // user can map columns. Empty on parse failure — the mapping panel then shows nothing to map.
  const readHeaders = async (selectedFile: File) => {
    try {
      const text = await selectedFile.text();
      const rows = parseCsvSync(text, {
        to: 1, columns: false, trim: true, bom: true, skip_empty_lines: true,
      }) as string[][];
      setSourceHeaders(rows[0] || []);
    } catch {
      setSourceHeaders([]);
    }
  };

  // Re-run auto-detection whenever a new file's headers load or the lead type changes. User edits to
  // the mapping persist (this only fires on file/type change, not on every mapping tweak).
  useEffect(() => {
    if (sourceHeaders.length && lead.type) {
      setColumnMapping(autoDetectMapping(sourceHeaders, canonicalFields(lead.type.toUpperCase() as LeadType)));
    } else {
      setColumnMapping({});
    }
  }, [sourceHeaders, lead.type]);

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

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const ownerAddr = ownerAddressRef.current;
    const adminAddr = adminAddressRef.current;

    if (!lead.type) return setMessage('❌ Missing: Lead Type');
    if (!lead.ownerFirstName) return setMessage('❌ Missing: First Name');
    if (!isValidName(lead.ownerFirstName)) return setMessage('❌ First Name may only contain letters and spaces');
    if (!lead.ownerLastName) return setMessage('❌ Missing: Last Name');
    if (!isValidName(lead.ownerLastName)) return setMessage('❌ Last Name may only contain letters and spaces');
    if (!ownerAddr) return setMessage('❌ Missing: Property Address — please select from the dropdown');
    if (lead.type === 'PROBATE') {
      if (!lead.adminFirstName) return setMessage('❌ Missing: Admin First Name');
      if (!isValidName(lead.adminFirstName)) return setMessage('❌ Admin First Name may only contain letters and spaces');
      if (!lead.adminLastName) return setMessage('❌ Missing: Admin Last Name');
      if (!isValidName(lead.adminLastName)) return setMessage('❌ Admin Last Name may only contain letters and spaces');
      if (!adminAddr) return setMessage('❌ Missing: Admin Address — please select from the dropdown');
    }

    // Phone is optional, but if provided it must be a valid US number
    let normalizedPhone: string | null = null;
    if (lead.phone?.trim()) {
      normalizedPhone = formatPhoneE164(lead.phone);
      if (!normalizedPhone) return setMessage('❌ Enter a valid 10-digit US phone number, or leave it blank');
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
          phone: normalizedPhone,
          ownerAddr,
          adminFirstName: lead.adminFirstName || null,
          adminLastName: lead.adminLastName || null,
          adminAddr: adminAddr || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Failed to create lead');

      setLeadCreated(true);
      setMessage('');
      ownerAddressRef.current = null;
      adminAddressRef.current = null;
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

    // Require the essential columns to be mapped so we never import rows missing address/name.
    const fields = canonicalFields(lead.type.toUpperCase() as LeadType);
    const missing = missingRequired(columnMapping, fields);
    if (missing.length > 0) {
      const labelFor = (k: string) =>
        k === 'ownerName' ? 'Owner name (full, or first + last)'
        : k === 'adminName' ? 'Administrator name (full, or first + last)'
        : (fields.find((f) => f.key === k)?.label || k);
      return setMessage(`❌ Map these required columns before importing: ${missing.map(labelFor).join(', ')}`);
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
        // The user's column mapping travels with the job; the Lambda reads it to resolve each field.
        // AWSJSON fields reject raw objects, so serialize with asJson (the Lambda parses either form).
        columnMapping: Object.keys(columnMapping).length ? asJson(columnMapping) : undefined,
        startedAt: new Date().toISOString(),
      });

      if (errors || !newJob) {
        console.error('❌ CsvUploadJob.create errors:', JSON.stringify(errors, null, 2));
        throw new Error(errors?.[0]?.message || 'Failed to create upload job');
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

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                // Clear the native input so its label can't show a previously-picked file.
                if (fileInputRef.current) fileInputRef.current.value = '';
                handleFileSelected(e.dataTransfer.files?.[0] || null);
              }}
              className={`p-4 border border-dashed rounded-md text-center transition-colors ${
                isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
              }`}
            >
              <label className='block text-xs font-bold text-gray-500 uppercase mb-2 text-left'>
                2. Upload File
              </label>
              <input
                ref={fileInputRef}
                type='file'
                accept='.csv'
                onChange={(e) => handleFileSelected(e.target.files?.[0] || null)}
                className='w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'
              />
              <p className='mt-2 text-xs text-gray-400'>
                {file ? <>Selected: <strong className='text-gray-600'>{file.name}</strong></> : 'or drag & drop a .csv file here'}
              </p>

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

            {sourceHeaders.length > 0 && lead.type && (
              <div className='bg-gray-50 p-4 rounded-md border border-gray-100'>
                <label className='block text-xs font-bold text-gray-500 uppercase mb-2'>
                  3. Map Columns
                </label>
                <p className='text-xs text-gray-500 mb-3'>
                  We auto-matched your file&apos;s columns to our fields — adjust any that are wrong.
                  Required fields are marked <span className='text-red-600'>*</span>.
                </p>
                <div className='space-y-2'>
                  {canonicalFields(lead.type.toUpperCase() as LeadType).map((f) => (
                    <div key={f.key} className='grid grid-cols-2 gap-2 items-center'>
                      <label className='text-xs text-gray-700'>
                        {f.label}
                        {f.required && <span className='text-red-600'> *</span>}
                      </label>
                      <select
                        value={columnMapping[f.key] || ''}
                        onChange={(e) =>
                          setColumnMapping((m) => {
                            const next = { ...m };
                            if (e.target.value) next[f.key] = e.target.value;
                            else delete next[f.key];
                            return next;
                          })
                        }
                        className='border border-gray-300 rounded px-2 py-1 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-100'
                      >
                        <option value=''>— skip —</option>
                        {sourceHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <p className='text-[11px] text-gray-400 mt-2'>
                  Owner name: map a single full-name column, <em>or</em> both first and last name columns.
                </p>
              </div>
            )}

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
                First Name *
              </label>
              <input
                className='w-full border p-2 rounded'
                value={lead.ownerFirstName}
                maxLength={NAME_MAX}
                onChange={(e) =>
                  setLead({ ...lead, ownerFirstName: sanitizeName(e.target.value) })
                }
                required
              />
            </div>
            <div>
              <label className='text-xs font-bold text-gray-400 uppercase'>
                Last Name *
              </label>
              <input
                className='w-full border p-2 rounded'
                value={lead.ownerLastName}
                maxLength={NAME_MAX}
                onChange={(e) =>
                  setLead({ ...lead, ownerLastName: sanitizeName(e.target.value) })
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
              inputMode='tel'
              maxLength={12}
              onChange={(e) => setLead({ ...lead, phone: sanitizePhoneInput(e.target.value) })}
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
            <AddressAutocomplete
              key={`owner-${autocompleteKey}`}
              onSelect={(addr) => { ownerAddressRef.current = addr; }}
            />
          </div>

          {lead.type === 'PROBATE' && (
            <div className='p-4 bg-gray-50 rounded-md border border-gray-100 space-y-4'>
              <h3 className='text-sm font-bold text-gray-700 border-b pb-2'>
                Admin / Executor Info
              </h3>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='text-xs font-bold text-gray-400 uppercase'>Admin First Name *</label>
                  <input
                    placeholder='Admin First Name'
                    className='border p-2 rounded bg-white w-full'
                    value={lead.adminFirstName}
                    maxLength={NAME_MAX}
                    onChange={(e) =>
                      setLead({ ...lead, adminFirstName: sanitizeName(e.target.value) })
                    }
                    required
                  />
                </div>
                <div>
                  <label className='text-xs font-bold text-gray-400 uppercase'>Admin Last Name *</label>
                  <input
                    placeholder='Admin Last Name'
                    className='border p-2 rounded bg-white w-full'
                    value={lead.adminLastName}
                    maxLength={NAME_MAX}
                    onChange={(e) =>
                      setLead({ ...lead, adminLastName: sanitizeName(e.target.value) })
                    }
                    required
                  />
                </div>
              </div>
              <div className='space-y-1'>
                <label className='text-xs font-bold text-gray-400 uppercase'>Admin Address *</label>
                <AddressAutocomplete
                  key={`admin-${autocompleteKey}`}
                  onSelect={(addr) => { adminAddressRef.current = addr; }}
                />
              </div>
            </div>
          )}

          {leadCreated ? (
            <div className='space-y-3'>
              <p className='text-center text-sm font-semibold text-green-700 bg-green-50 border border-green-200 p-3 rounded'>
                ✅ Lead added successfully! What would you like to do next?
              </p>
              <div className='grid grid-cols-2 gap-3'>
                <button
                  type='button'
                  onClick={() => {
                    setLeadCreated(false);
                    setMessage('');
                    // Remount the autocomplete widgets so their inputs clear for the next lead.
                    setAutocompleteKey((k) => k + 1);
                  }}
                  className='w-full border border-blue-600 text-blue-600 p-3 rounded-md font-bold hover:bg-blue-50 transition-colors'
                >
                  Add Another Lead
                </button>
                <button
                  type='button'
                  onClick={() => router.push('/dashboard')}
                  className='w-full bg-blue-600 text-white p-3 rounded-md font-bold hover:bg-blue-700 transition-colors'
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <button
              type='submit'
              disabled={loading}
              className='w-full bg-blue-600 text-white p-3 rounded-md font-bold hover:bg-blue-700 disabled:bg-gray-300 transition-colors'
            >
              {loading ? 'Adding...' : 'Save Manual Lead'}
            </button>
          )}
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
