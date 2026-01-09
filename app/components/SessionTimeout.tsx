'use client';

import { useEffect, useRef } from 'react';
import { signOut } from 'aws-amplify/auth';

export default function SessionTimeout() {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const TIMEOUT_DURATION = 30 * 60 * 1000; // 30 minutes

  const resetTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(async () => {
      try {
        await signOut();
        window.location.href = '/login?reason=timeout';
      } catch (error) {
        console.error('Session timeout logout failed:', error);
      }
    }, TIMEOUT_DURATION);
  };

  useEffect(() => {
    // Events that indicate user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Reset timeout on any user activity
    const handleActivity = () => resetTimeout();
    
    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Start initial timeout
    resetTimeout();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return null;
}
