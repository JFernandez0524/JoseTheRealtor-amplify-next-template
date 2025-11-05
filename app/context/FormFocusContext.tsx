'use client';

import { createContext, useState, useContext, useMemo, ReactNode } from 'react';

// Define the shape of the context data
interface FormFocusContextType {
  isFormFocused: boolean;
  setIsFormFocused: (isFocused: boolean) => void;
  hasAnalysisRun: boolean; // 👈 ADD THIS
  setHasAnalysisRun: (hasRun: boolean) => void; // 👈 ADD THIS
}

// Create the context
const FormFocusContext = createContext<FormFocusContextType | undefined>(
  undefined
);

// Create the Provider component
export function FormFocusProvider({ children }: { children: ReactNode }) {
  const [isFormFocused, setIsFormFocused] = useState(false);
  const [hasAnalysisRun, setHasAnalysisRun] = useState(false); // 👈 ADD THIS

  const value = useMemo(
    () => ({
      isFormFocused,
      setIsFormFocused,
      hasAnalysisRun, // 👈 ADD THIS
      setHasAnalysisRun, // 👈 ADD THIS
    }),
    [isFormFocused, hasAnalysisRun]
  ); // 👈 ADD DEPENDENCY

  return (
    <FormFocusContext.Provider value={value}>
      {children}
    </FormFocusContext.Provider>
  );
}

// Create a custom hook to easily use the context
export function useFormFocus() {
  const context = useContext(FormFocusContext);
  if (context === undefined) {
    throw new Error('useFormFocus must be used within a FormFocusProvider');
  }
  return context;
}
