'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccess } from '@/app/context/AccessContext';
import { useUserProfile } from '@/app/hooks/useUserProfile';
import { HiExclamationTriangle, HiArrowRight } from 'react-icons/hi2';

export default function NoCreditsBanner() {
  const { credits, isLoading } = useAccess();
  const attributes = useUserProfile();
  const pathname = usePathname();

  const isAuthenticated = !isLoading && !!attributes?.email;

  // Only show for logged in users who have 0 credits and are not already on the pricing page
  if (isLoading || !isAuthenticated || credits > 0 || pathname === '/pricing') {
    return null;
  }

  return (
    <div className="bg-amber-400 text-amber-950 border-t border-b border-amber-500/30">
      <div className="max-w-7xl mx-auto px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 text-center sm:text-left">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
          <HiExclamationTriangle className="w-4 h-4 text-amber-900 shrink-0" />
          <span>
            You have 0 skip tracing credits. Purchase credits to unlock owner contact information.
          </span>
        </div>
        <Link
          href="/pricing"
          className="shrink-0 inline-flex items-center gap-1.5 bg-amber-950 hover:bg-black text-white font-bold text-xs sm:text-sm px-3.5 py-1.5 rounded-lg shadow-xs transition-all"
        >
          <span>Purchase Credits</span>
          <HiArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
