'use client';

import React, { createContext, useContext, ReactNode } from 'react';

interface AccessContextType {
  isPro: boolean;
  isAdmin: boolean;
  isAI: boolean;
  hasPaidPlan: boolean;
}

// 🛡️ Give it a default value so it doesn't crash during build/SSR
const defaultAccess: AccessContextType = {
  isPro: false,
  isAdmin: false,
  isAI: false,
  hasPaidPlan: false,
};

const AccessContext = createContext<AccessContextType>(defaultAccess);

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

export function useAccess() {
  const context = useContext(AccessContext);
  // No longer throwing error; returns defaultAccess if outside provider
  return context;
}
