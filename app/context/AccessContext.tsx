'use client';

import React, { createContext, useContext, ReactNode } from 'react';

interface AccessContextType {
  isPro: boolean;
  isAdmin: boolean;
  isAI: boolean;
  hasPaidPlan: boolean;
}

const AccessContext = createContext<AccessContextType | undefined>(undefined);

export function AccessProvider({
  children,
  access,
}: {
  children: ReactNode;
  access: AccessContextType;
}) {
  return (
    <AccessContext.Provider value={access}>{children}</AccessContext.Provider>
  );
}

// This is the hook you will use in your buttons and tables
export function useAccess() {
  const context = useContext(AccessContext);
  if (context === undefined) {
    throw new Error('useAccess must be used within an AccessProvider');
  }
  return context;
}
