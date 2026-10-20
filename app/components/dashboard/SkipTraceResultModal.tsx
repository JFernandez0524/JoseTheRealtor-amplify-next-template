'use client';

export interface ReachabilityLead {
  id: string;
  ownerAddress?: string | null;
  ownerCity?: string | null;
  ownerState?: string | null;
  phones?: (string | null)[] | null;
  landlinePhones?: (string | null)[] | null;
  emails?: (string | null)[] | null;
  skipTraceStatus?: string | null;
  listingStatus?: string | null;
  leadLabels?: (string | null)[] | null;
  zestimate?: number | null;
  estimatedValue?: number | null;
}

export interface ReachabilityBreakdown {
  totalProcessed: number;
  matchedCount: number;
  mobileAndEmail: number;
  mobileOnly: number;
  totalMobileLeads: number;
  totalMobileNumbers: number;
  landlineAndEmail: number;
  landlineOnly: number;
  totalLandlineLeads: number;
  totalLandlineNumbers: number;
  emailOnly: number;
  totalEmailLeads: number;
  totalEmails: number;
  directMailOnlyCount: number;
  directMailOnlyAddresses: string[];
  noMatchCount: number;
  noMatchAddresses: string[];
  failedCount: number;
  failedAddresses: string[];
  syncEligibleIds: string[];
}

function cleanArray(arr: (string | null)[] | null | undefined): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
}

export function isLeadOffMarket(lead: ReachabilityLead): boolean {
  const status = (lead.listingStatus || '').trim().toLowerCase();
  if (status && status !== 'off_market') return false;
  const labels = Array.isArray(lead.leadLabels) ? lead.leadLabels : [];
  if (labels.some((l) => l === 'ACTIVE_MLS' || l === 'RECENTLY_SOLD')) return false;
  return true;
}

export function isLeadSyncEligible(lead: ReachabilityLead): boolean {
  if (!isLeadOffMarket(lead)) return false;
  const skipStatus = (lead.skipTraceStatus || '').trim().toUpperCase();
  return skipStatus === 'COMPLETED' || skipStatus === 'NO_QUALITY_CONTACTS';
}

export function computeReachabilityBreakdown(leads: ReachabilityLead[]): ReachabilityBreakdown {
  let mobileAndEmail = 0;
  let mobileOnly = 0;
  let totalMobileNumbers = 0;
  let landlineAndEmail = 0;
  let landlineOnly = 0;
  let totalLandlineNumbers = 0;
  let emailOnly = 0;
  let totalEmails = 0;

  const directMailOnlyAddresses: string[] = [];
  const noMatchAddresses: string[] = [];
  const failedAddresses: string[] = [];
  const syncEligibleIds: string[] = [];

  for (const lead of leads) {
    const phones = cleanArray(lead.phones);
    const landlines = cleanArray(lead.landlinePhones);
    const emails = cleanArray(lead.emails);
    const skipStatus = (lead.skipTraceStatus || '').trim().toUpperCase();
    const addr = lead.ownerAddress?.trim() || lead.id;

    if (isLeadSyncEligible(lead)) {
      syncEligibleIds.push(lead.id);
    }

    if (skipStatus === 'NO_MATCH') {
      noMatchAddresses.push(addr);
      continue;
    }

    if (skipStatus === 'FAILED' || skipStatus === 'ERROR') {
      failedAddresses.push(addr);
      continue;
    }

    const hasM = phones.length > 0;
    const hasL = landlines.length > 0;
    const hasE = emails.length > 0;

    totalMobileNumbers += phones.length;
    totalLandlineNumbers += landlines.length;
    totalEmails += emails.length;

    if (hasM && hasE) {
      mobileAndEmail++;
    } else if (hasM && !hasE) {
      mobileOnly++;
    } else if (!hasM && hasL && hasE) {
      landlineAndEmail++;
    } else if (!hasM && hasL && !hasE) {
      landlineOnly++;
    } else if (!hasM && !hasL && hasE) {
      emailOnly++;
    } else {
      directMailOnlyAddresses.push(addr);
    }
  }

  const totalMobileLeads = mobileAndEmail + mobileOnly;
  const totalLandlineLeads = landlineAndEmail + landlineOnly;
  const totalEmailLeads = mobileAndEmail + landlineAndEmail + emailOnly;
  const directMailOnlyCount = directMailOnlyAddresses.length;
  const noMatchCount = noMatchAddresses.length;
  const failedCount = failedAddresses.length;
  const matchedCount =
    totalMobileLeads + totalLandlineLeads + emailOnly + directMailOnlyCount;

  return {
    totalProcessed: leads.length,
    matchedCount,
    mobileAndEmail,
    mobileOnly,
    totalMobileLeads,
    totalMobileNumbers,
    landlineAndEmail,
    landlineOnly,
    totalLandlineLeads,
    totalLandlineNumbers,
    emailOnly,
    totalEmailLeads,
    totalEmails,
    directMailOnlyCount,
    directMailOnlyAddresses,
    noMatchCount,
    noMatchAddresses,
    failedCount,
    failedAddresses,
    syncEligibleIds,
  };
}

interface SkipTraceResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  breakdown: ReachabilityBreakdown | null;
  onSyncEligible?: () => void;
}

export function SkipTraceResultModal({
  isOpen,
  onClose,
  breakdown,
  onSyncEligible,
}: SkipTraceResultModalProps) {
  if (!isOpen || !breakdown) return null;

  const matchRate =
    breakdown.totalProcessed > 0
      ? ((breakdown.matchedCount / breakdown.totalProcessed) * 100).toFixed(1)
      : '0.0';

  const rows = [
    {
      label: 'Mobile + Email',
      count: breakdown.mobileAndEmail,
      details: 'Mobile dialer + Cold email drip',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    },
    {
      label: 'Mobile Only',
      count: breakdown.mobileOnly,
      details: `Mobile dialer (${breakdown.totalMobileLeads} total leads with mobile / ${breakdown.totalMobileNumbers} numbers)`,
      badgeClass: 'bg-green-50 text-green-800 border-green-200',
    },
    {
      label: 'Landline + Email',
      count: breakdown.landlineAndEmail,
      details: 'Landline dialer + Cold email drip',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    },
    {
      label: 'Landline Only',
      count: breakdown.landlineOnly,
      details: `Landline dialer (${breakdown.totalLandlineLeads} total leads with non-DNC landlines / ${breakdown.totalLandlineNumbers} numbers)`,
      badgeClass: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    },
    {
      label: 'Email Only',
      count: breakdown.emailOnly,
      details: `Cold email drip (${breakdown.totalEmailLeads} total leads with validated email / ${breakdown.totalEmails} emails)`,
      badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    },
    {
      label: 'Direct Mail Only',
      count: breakdown.directMailOnlyCount,
      details:
        breakdown.directMailOnlyAddresses.length > 0
          ? `${breakdown.directMailOnlyAddresses.join(', ')} (matched, but phones were DNC/filtered and emails failed validation)`
          : 'Matched, but phones were DNC/filtered and emails failed validation',
      badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
    },
    {
      label: 'No Match',
      count: breakdown.noMatchCount,
      details:
        breakdown.noMatchAddresses.length > 0
          ? `${breakdown.noMatchAddresses.join(', ')} (not charged · excluded from Launch AI sync)`
          : 'No owner match in BatchData (not charged · excluded from Launch AI sync)',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 md:p-8 max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Skip Trace Results Summary</h2>
            <p className="text-sm text-slate-600 mt-1">
              Total Processed: <span className="font-semibold text-slate-900">{breakdown.totalProcessed}</span> leads ·{' '}
              Matched (<code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">COMPLETED</code>):{' '}
              <span className="font-semibold text-emerald-700">{breakdown.matchedCount}</span> ({matchRate}% match rate) ·{' '}
              No Match (Not Charged): <span className="font-semibold text-slate-700">{breakdown.noMatchCount}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg font-bold px-2"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Breakdown Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl mb-6">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-bold">Reachability Breakdown</th>
                <th className="px-4 py-3 font-bold text-center w-24">Leads</th>
                <th className="px-4 py-3 font-bold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.label} className={row.count === 0 ? 'opacity-50' : 'hover:bg-slate-50/70'}>
                  <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold border ${row.badgeClass}`}>
                      {row.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-900 text-base">
                    {row.count}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs leading-relaxed">
                    {row.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notice on NO_MATCH deselection */}
        {breakdown.noMatchCount > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-900">
            <strong>Note:</strong> The {breakdown.noMatchCount} <code className="bg-amber-100 px-1 py-0.5 rounded">NO_MATCH</code> lead
            {breakdown.noMatchCount !== 1 ? 's were' : ' was'} not charged by BatchData and {breakdown.noMatchCount !== 1 ? 'have' : 'has'} been automatically excluded from Launch AI sync selection.
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            Done
          </button>
          {onSyncEligible && breakdown.syncEligibleIds.length > 0 && (
            <button
              onClick={() => {
                onClose();
                onSyncEligible();
              }}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Sync {breakdown.syncEligibleIds.length} Matched Lead{breakdown.syncEligibleIds.length !== 1 ? 's' : ''} to Launch AI
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
