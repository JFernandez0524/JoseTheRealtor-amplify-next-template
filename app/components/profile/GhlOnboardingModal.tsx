'use client';

import { useState, useEffect } from 'react';
import {
  HiOutlineCheckCircle,
  HiOutlineSparkles,
  HiOutlinePhone,
  HiOutlineTag,
  HiOutlineDocumentDuplicate,
  HiOutlineArrowRight,
  HiOutlineXMark,
} from 'react-icons/hi2';

interface GhlOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationId?: string;
  onStartSetup: () => void;
}

export default function GhlOnboardingModal({
  isOpen,
  onClose,
  locationId,
  onStartSetup,
}: GhlOnboardingModalProps) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    // Sequential checkmark animations
    const timers = [
      setTimeout(() => setActiveStep(1), 400),
      setTimeout(() => setActiveStep(2), 900),
      setTimeout(() => setActiveStep(3), 1400),
      setTimeout(() => setActiveStep(4), 1800),
    ];

    return () => timers.forEach(clearTimeout);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 px-6 pt-8 pb-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Close modal"
          >
            <HiOutlineXMark className="w-5 h-5" />
          </button>
          
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
            <HiOutlineSparkles className="w-7 h-7 text-amber-300 animate-pulse" />
          </div>
          
          <h3 className="text-2xl font-black tracking-tight">
            GoHighLevel Connected!
          </h3>
          <p className="text-indigo-100 text-sm mt-1 max-w-sm mx-auto">
            Your CRM is linked. DealFinder has automatically configured your real estate pipeline.
          </p>
        </div>

        {/* Body / Step Progress */}
        <div className="p-6 space-y-3.5">
          {/* Step 1 */}
          <div
            className={`flex items-start gap-3.5 p-3 rounded-2xl border transition-all duration-500 ${
              activeStep >= 1
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
            }`}
          >
            <div className="mt-0.5">
              {activeStep >= 1 ? (
                <HiOutlineCheckCircle className="w-5 h-5 text-emerald-600 animate-bounce" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
              )}
            </div>
            <div className="text-sm">
              <p className="font-bold">Sub-Account Linked</p>
              <p className="text-xs text-slate-500 font-mono">
                {locationId ? `Location ID: ${locationId}` : 'OAuth token verified and active'}
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div
            className={`flex items-start gap-3.5 p-3 rounded-2xl border transition-all duration-500 ${
              activeStep >= 2
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
            }`}
          >
            <div className="mt-0.5">
              {activeStep >= 2 ? (
                <HiOutlineCheckCircle className="w-5 h-5 text-emerald-600" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
              )}
            </div>
            <div className="text-sm">
              <p className="font-bold flex items-center gap-1.5">
                <HiOutlineDocumentDuplicate className="w-4 h-4 text-emerald-700" />
                35+ Custom Fields Provisioned
              </p>
              <p className="text-xs text-slate-500">
                Property valuation, equity, foreclosure dates &amp; lead dispositions ready.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div
            className={`flex items-start gap-3.5 p-3 rounded-2xl border transition-all duration-500 ${
              activeStep >= 3
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
            }`}
          >
            <div className="mt-0.5">
              {activeStep >= 3 ? (
                <HiOutlineCheckCircle className="w-5 h-5 text-emerald-600" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
              )}
            </div>
            <div className="text-sm">
              <p className="font-bold flex items-center gap-1.5">
                <HiOutlineTag className="w-4 h-4 text-emerald-700" />
                Workflow &amp; System Tags Created
              </p>
              <p className="text-xs text-slate-500">
                <code className="bg-white px-1.5 py-0.5 rounded border text-[11px]">App:Synced</code>, <code className="bg-white px-1.5 py-0.5 rounded border text-[11px]">Ready-For-Human-Contact</code>, and trigger tags.
              </p>
            </div>
          </div>

          {/* Step 4 - Action Needed */}
          <div
            className={`flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all duration-500 ${
              activeStep >= 4
                ? 'bg-indigo-50 border-indigo-200 text-indigo-950'
                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
            }`}
          >
            <div className="mt-0.5 text-indigo-600">
              <HiOutlinePhone className="w-5 h-5" />
            </div>
            <div className="text-sm">
              <p className="font-bold text-indigo-900">Final Step: Confirm Outreach Phone &amp; Key</p>
              <p className="text-xs text-indigo-700">
                Select your sender number and add your OpenAI key to start automated AI outreach.
              </p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors order-2 sm:order-1"
          >
            I&apos;ll configure this later
          </button>
          
          <button
            type="button"
            onClick={() => {
              onClose();
              onStartSetup();
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all order-1 sm:order-2"
          >
            <span>Complete Profile Setup</span>
            <HiOutlineArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
