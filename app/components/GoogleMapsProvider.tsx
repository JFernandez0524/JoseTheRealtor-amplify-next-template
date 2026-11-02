'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { useAuthenticator } from '@aws-amplify/ui-react';

const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

interface GoogleMapsContextType {
  isLoaded: boolean;
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({ isLoaded: false });

function AuthenticatedMapsLoader({ children }: { children: ReactNode }) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });

  return (
    <GoogleMapsContext.Provider value={{ isLoaded }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);

  if (authStatus !== 'authenticated') {
    return (
      <GoogleMapsContext.Provider value={{ isLoaded: false }}>
        {children}
      </GoogleMapsContext.Provider>
    );
  }

  return <AuthenticatedMapsLoader>{children}</AuthenticatedMapsLoader>;
}

export function useGoogleMaps() {
  return useContext(GoogleMapsContext);
}
