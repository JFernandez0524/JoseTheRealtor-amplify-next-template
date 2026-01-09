'use client';

import { useEffect } from 'react';
import { signOut } from 'aws-amplify/auth';

export default function AutoLogout() {
  useEffect(() => {
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      try {
        // Log out user when they close browser/tab
        await signOut();
      } catch (error) {
        console.error('Auto logout failed:', error);
      }
    };

    const handleVisibilityChange = async () => {
      // Log out when tab becomes hidden (optional - more aggressive)
      if (document.visibilityState === 'hidden') {
        try {
          await signOut();
        } catch (error) {
          console.error('Auto logout failed:', error);
        }
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null; // This component doesn't render anything
}
