'use client';

import { useEffect, useRef } from 'react';
import { useGoogleMaps } from '@/app/components/GoogleMapsProvider';

/**
 * The parsed, standardized address a user picked from the Google Places dropdown. Because it comes
 * from a Google suggestion it is validated by construction — callers can trust it and mark the lead
 * VALID without a separate server-side validation pass (the same reason /api/v1/create-manual-lead
 * trusts the manual form's selection).
 */
export interface ParsedAddress {
  formattedAddress: string;
  street: string;
  city: string;
  state: string; // 2-letter code, e.g. "NJ"
  zip: string;
  county: string;
  lat: number | null;
  lng: number | null;
}

interface AddressAutocompleteProps {
  /** Called with the parsed address each time the user selects a suggestion. */
  onSelect: (addr: ParsedAddress) => void;
  /** Wrapper class for the mount point (defaults to a bordered box). */
  className?: string;
}

/**
 * Google Places address autocomplete, extracted from ManualLeadForm so the manual lead form and the
 * dashboard "Edit Address" modal share one implementation of the `PlaceAutocompleteElement` mount +
 * `gmp-select` parsing (DRY — one source of truth for how we turn a Google place into our address
 * fields). Relies on GoogleMapsProvider (root layout) having loaded the Maps `places` library.
 *
 * USED BY: app/components/upload/ManualLeadForm.tsx, app/components/dashboard/LeadTable.tsx.
 */
export function AddressAutocomplete({ onSelect, className }: AddressAutocompleteProps) {
  const { isLoaded } = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep the latest onSelect without re-running the mount effect (which would duplicate the widget).
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!isLoaded) return;

    const G = (window as any).google?.maps?.places;
    if (!G?.PlaceAutocompleteElement) return;
    if (!containerRef.current || containerRef.current.hasChildNodes()) return;

    const el = new G.PlaceAutocompleteElement({ includedRegionCodes: ['us'] });
    containerRef.current.appendChild(el);

    el.addEventListener('gmp-select', async (event: any) => {
      const place = event.placePrediction.toPlace();
      await place.fetchFields({ fields: ['formattedAddress', 'addressComponents', 'location'] });
      const getComp = (type: string, useShort = false) => {
        const c = place.addressComponents?.find((comp: any) => comp.types.includes(type));
        return useShort ? (c?.shortText || '') : (c?.longText || '');
      };
      const street = `${getComp('street_number')} ${getComp('route')}`.trim();
      const city = getComp('locality') || getComp('administrative_area_level_3');
      const state = getComp('administrative_area_level_1', true); // shortText = "NJ" not "New Jersey"
      const zip = getComp('postal_code');
      const county = getComp('administrative_area_level_2');
      onSelectRef.current({
        formattedAddress: place.formattedAddress ?? '',
        street,
        city,
        state,
        zip,
        county,
        lat: place.location?.lat() ?? null,
        lng: place.location?.lng() ?? null,
      });
    });

    const container = containerRef.current;
    return () => {
      // Clear the widget on unmount so a remount (e.g. reopening the edit modal) rebuilds it cleanly.
      if (container) container.innerHTML = '';
    };
  }, [isLoaded]);

  return <div ref={containerRef} className={className ?? 'border rounded'} />;
}
