'use client';

import { useState } from 'react';
import {
  HiOutlineBookOpen,
  HiOutlineShieldCheck,
  HiOutlineArrowPath,
  HiOutlineChatBubbleLeftRight,
  HiOutlineXMark,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineSparkles,
} from 'react-icons/hi2';

interface MarketplaceGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'skiptrace' | 'sync' | 'ai' | 'troubleshoot';
}

export default function MarketplaceGuideModal({
  isOpen,
  onClose,
  initialTab = 'skiptrace',
}: MarketplaceGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'skiptrace' | 'sync' | 'ai' | 'troubleshoot'>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-fade-in">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <HiOutlineBookOpen className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                DealFinder Testing &amp; Compliance Guide
              </h3>
              <p className="text-xs text-indigo-200">
                GoHighLevel Marketplace Review &amp; Architecture Walkthrough
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Close guide"
          >
            <HiOutlineXMark className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('skiptrace')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'skiptrace'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <HiOutlineShieldCheck className="w-4 h-4" />
            1. Skip-Tracing &amp; DNC
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'sync'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <HiOutlineArrowPath className="w-4 h-4" />
            2. GHL CRM Sync
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'ai'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <HiOutlineChatBubbleLeftRight className="w-4 h-4" />
            3. AI &amp; SMS Rules
          </button>
          <button
            onClick={() => setActiveTab('troubleshoot')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'troubleshoot'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <HiOutlineExclamationTriangle className="w-4 h-4" />
            4. Sync Error Help
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-600 leading-relaxed">
          {/* TAB 1: SKIP-TRACING */}
          {activeTab === 'skiptrace' && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
                <h4 className="text-sm font-bold text-indigo-950 flex items-center gap-2 mb-1">
                  <HiOutlineSparkles className="w-4 h-4 text-indigo-600" />
                  How Skip-Tracing Works
                </h4>
                <p className="text-xs text-indigo-900">
                  DealFinder queries BatchData to match off-market property records against public records and tier-1 telco databases to locate verified property owners, phone numbers, emails, and mailing addresses.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm">
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                    📋 Required Info to Skip Trace
                  </h5>
                  <ul className="text-xs space-y-1.5 list-disc list-inside text-slate-700">
                    <li><strong>Standard / Preforeclosure:</strong> Street Address, City, State, ZIP + Owner Name.</li>
                    <li><strong>Probate Leads:</strong> Administrator/Executor Name + Admin Address.</li>
                    <li><strong>Status:</strong> Must be <strong>Off-Market</strong> (active MLS listings are excluded).</li>
                  </ul>
                </div>

                <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm">
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                    🛡️ Compliance &amp; DNC Filtering
                  </h5>
                  <ul className="text-xs space-y-1.5 list-disc list-inside text-slate-700">
                    <li><strong>DNC Scrubbing:</strong> Any phone number on the National or State DNC list is <strong>unconditionally filtered out</strong>.</li>
                    <li><strong>Mobile Quality (Score 90+):</strong> Only verified mobile numbers with carrier confidence &ge; 90 are used.</li>
                    <li><strong>Landline Separation:</strong> Landlines are stored separately and structurally blocked from SMS.</li>
                    <li><strong>DeBounce Validation:</strong> All emails are verified via DeBounce; undeliverables are dropped.</li>
                  </ul>
                </div>
              </div>

              {/* Manual Lead Entry Bypass Callout */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                <span className="text-xl">💡</span>
                <div>
                  <h5 className="text-xs font-bold text-emerald-950">
                    Manual Entry Bypass (No Skip-Tracing Required)
                  </h5>
                  <p className="text-xs text-emerald-900 mt-0.5">
                    If you already have a property owner&apos;s phone number or do not wish to spend skip-trace credits, you can add the lead manually with a phone number. The system automatically sets the status to <strong>COMPLETED</strong>, making it instantly eligible to sync to GoHighLevel!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GHL CRM SYNC */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-2 mb-1">
                  <HiOutlineCheckCircle className="w-4 h-4 text-emerald-600" />
                  What Information is Necessary to Sync to GHL
                </h4>
                <p className="text-xs text-emerald-900">
                  To protect your CRM from bad data and respect real estate regulations, contacts must meet these 4 criteria before syncing:
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="font-black text-indigo-600 bg-indigo-50 w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5">1</span>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Active GoHighLevel Connection</p>
                    <p className="text-xs text-slate-500">Your sub-account must be connected via OAuth in Profile Settings.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="font-black text-indigo-600 bg-indigo-50 w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5">2</span>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Completed Skip Trace</p>
                    <p className="text-xs text-slate-500">The lead must have a status of <code>COMPLETED</code>, <code>NO_MATCH</code>, or <code>NO_QUALITY_CONTACTS</code> (for direct mail).</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="font-black text-indigo-600 bg-indigo-50 w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5">3</span>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Reachable Contact Channel</p>
                    <p className="text-xs text-slate-500">Must have an Owner Name and at least one contact channel (Phone, Email, or Valid Mailing Address for Direct Mail).</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="font-black text-indigo-600 bg-indigo-50 w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5">4</span>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Off-Market Status</p>
                    <p className="text-xs text-slate-500">Properties actively listed on MLS are excluded to prevent contacting already-represented sellers.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI & SMS RULES */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                <h4 className="text-sm font-bold text-purple-950 mb-1">
                  Conversational AI Response (No Cold SMS Blasts)
                </h4>
                <p className="text-xs text-purple-900">
                  DealFinder does <strong>not</strong> send cold automated SMS blasts. SMS is used strictly for conversational AI response and lead qualification.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-2xl p-4 bg-white">
                  <p className="font-bold text-slate-900 text-xs mb-2">✉️ Outbound Cold Outreach</p>
                  <p className="text-xs text-slate-600">
                    Handled via compliant <strong>Cold Email</strong> (7-touch cadence every 4 days) and <strong>Direct Mail</strong> postcards with QR codes.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-2xl p-4 bg-white">
                  <p className="font-bold text-slate-900 text-xs mb-2">💬 Inbound AI Text Conversations</p>
                  <p className="text-xs text-slate-600">
                    When a lead texts in or replies to email/mail, the AI engages in real-time to answer property questions, qualify motivation, and book appointments on the agent&apos;s calendar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TROUBLESHOOTING */}
          {activeTab === 'troubleshoot' && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-900 mb-1">
                Common Sync Errors &amp; Solutions
              </h4>

              <div className="border border-amber-200 bg-amber-50/60 rounded-2xl p-3.5 text-xs">
                <p className="font-bold text-amber-950">⚠️ Skip trace not completed</p>
                <p className="text-amber-900 mt-0.5">
                  <strong>Why:</strong> The lead has not been skip-traced yet.<br />
                  <strong>Fix:</strong> Select the lead and click <em>&ldquo;Skip Trace&rdquo;</em> before syncing.
                </p>
              </div>

              <div className="border border-blue-200 bg-blue-50/60 rounded-2xl p-3.5 text-xs">
                <p className="font-bold text-blue-950">⚠️ Not eligible: listing status is active</p>
                <p className="text-blue-900 mt-0.5">
                  <strong>Why:</strong> The property is currently active or pending on MLS.<br />
                  <strong>Fix:</strong> Only off-market properties are eligible for cold CRM sync.
                </p>
              </div>

              <div className="border border-red-200 bg-red-50/60 rounded-2xl p-3.5 text-xs">
                <p className="font-bold text-red-950">❌ GHL not connected or token expired</p>
                <p className="text-red-900 mt-0.5">
                  <strong>Why:</strong> OAuth token needs re-authorization.<br />
                  <strong>Fix:</strong> Go to Profile Settings and click <em>&ldquo;Connect GoHighLevel&rdquo;</em>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-right shrink-0">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
