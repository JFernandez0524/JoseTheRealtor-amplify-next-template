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
      const streetNumber = getComp('street_number');
      const route = getComp('route');
      const street = `${streetNumber} ${route}`.trim() || place.formattedAddress?.split(',')[0]?.trim() || '';

      // Comprehensive city resolution for all 50 US states & territories:
      // - Standard US cities/towns: locality
      // - NYC boroughs / NY Long Island: sublocality_level_1, sublocality, postal_town, neighborhood
      // - New England / PA / Midwest townships: administrative_area_level_3, postal_town
      let city =
        getComp('locality') ||
        getComp('sublocality_level_1') ||
        getComp('sublocality') ||
        getComp('postal_town') ||
        getComp('administrative_area_level_3') ||
        getComp('neighborhood');

      let state = getComp('administrative_area_level_1', true); // shortText = 2-letter state code (e.g. "NY", "NJ", "CA")
      let zip = getComp('postal_code');
      const county = getComp('administrative_area_level_2');

      // Universal US fallback from formattedAddress (e.g. "123 Main St, Brooklyn, NY 11201, USA")
      if (place.formattedAddress) {
        const parts = place.formattedAddress.split(',').map((p: string) => p.trim());
        if (!city && parts.length >= 3) {
          city = parts[1];
        }
        if ((!state || !zip) && parts.length >= 3) {
          for (let i = parts.length - 1; i >= 1; i--) {
            const match = parts[i].match(/\b([A-Z]{2})\b(?:\s+(\d{5}(?:-\d{4})?))?/);
            if (match) {
              if (!state) state = match[1];
              if (!zip && match[2]) zip = match[2];
              break;
            }
          }
        }
      }

      onSelectRef.current({
        formattedAddress: place.formattedAddress ?? '',
        street,
        city: city || '',
        state: state || '',
        zip: zip || '',
        county: county || '',
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
