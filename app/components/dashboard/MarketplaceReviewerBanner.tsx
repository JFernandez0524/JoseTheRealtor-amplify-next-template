'use client';

import { useState } from 'react';
import {
  HiOutlineSparkles,
  HiOutlineBookOpen,
  HiOutlineShieldCheck,
  HiOutlineInformationCircle,
} from 'react-icons/hi2';
import MarketplaceGuideModal from './MarketplaceGuideModal';

interface MarketplaceReviewerBannerProps {
  userEmail?: string | null;
  totalSkipsPerformed?: number;
}

export default function MarketplaceReviewerBanner({
  userEmail,
  totalSkipsPerformed = 0,
}: MarketplaceReviewerBannerProps) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const normalizedEmail = (userEmail || '').toLowerCase().trim();
  const isReviewer = normalizedEmail === 'ghl-reviewer@yourailaunch.com';

  if (!isReviewer) return null;

  const maxSkips = 5;
  const skipsUsed = Math.min(maxSkips, Math.max(0, totalSkipsPerformed));
  const skipsRemaining = Math.max(0, maxSkips - skipsUsed);

  return (
    <>
      <MarketplaceGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      <div className="bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 text-white p-4 rounded-2xl shadow-md mb-6 border border-amber-300/30">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shrink-0">
              <HiOutlineSparkles className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-white/20 text-white font-black text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full border border-white/30">
                  Marketplace Reviewer Mode
                </span>
                <span className="text-xs text-indigo-100 font-mono">
                  {userEmail}
                </span>
              </div>
              <p className="text-xs text-indigo-100 mt-1">
                You have <strong>{skipsRemaining} of {maxSkips} demo skip-trace credits</strong> remaining for marketplace testing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={() => setIsGuideOpen(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-white text-indigo-900 hover:bg-indigo-50 text-xs font-bold px-4 py-2 rounded-xl shadow transition-colors"
            >
              <HiOutlineBookOpen className="w-4 h-4 text-indigo-600" />
              <span>Testing &amp; Compliance Guide</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
