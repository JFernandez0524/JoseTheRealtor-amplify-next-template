'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader } from '@aws-amplify/ui-react';
import { useFormFocus } from '@/app/context/FormFocusContext';

type AnalyzerFormProps = {
  address: string;
  setAddress: (value: string) => void;
  handleSubmit: (e: React.FormEvent, placeDetails?: any) => void;
  isLoading: boolean;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gmp-place-autocomplete': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { ref?: any },
        HTMLElement
      >;
    }
  }
}

export default function AnalyzerForm({
  address,
  setAddress,
  handleSubmit,
  isLoading,
}: AnalyzerFormProps) {
  const { setIsFormFocused } = useFormFocus();
  const autocompleteRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasText, setHasText] = useState(false);

  // 🎯 Store the Google details without triggering the API immediately
  const [pendingDetails, setPendingDetails] = useState<any>(null);

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== address) {
      inputRef.current.value = address;
      setHasText(!!address);
    }
  }, [address]);

  useEffect(() => {
    const el = autocompleteRef.current;
    if (!el) return;

    const onPlaceSelect = async (event: any) => {
      const prediction = event.placePrediction || event.detail?.placePrediction;
      if (prediction) {
        try {
          const place = prediction.toPlace();
          await place.fetchFields({
            fields: ['formattedAddress', 'addressComponents', 'location'],
          });

          const components = place.addressComponents;
          const getComp = (type: string, useShort = false) => {
            const c = components?.find((c: any) => c.types.includes(type));
            return useShort ? c?.shortText : c?.longText;
          };

          const details = {
            street:
              `${getComp('street_number') || ''} ${getComp('route') || ''}`.trim(),
            city: getComp('locality'),
            state: getComp('administrative_area_level_1', true),
            zip: getComp('postal_code'),
            lat: place.location?.lat(),
            lng: place.location?.lng(),
          };

          if (place.formattedAddress) {
            setAddress(place.formattedAddress);
            setHasText(true);
            setPendingDetails(details); // ✅ Save details for manual submit
            if (inputRef.current)
              inputRef.current.value = place.formattedAddress;
          }
        } catch (err) {
          console.error('Error fetching details:', err);
        }
      }
    };

    el.addEventListener('gmp-select', onPlaceSelect);
    return () => el.removeEventListener('gmp-select', onPlaceSelect);
  }, [setAddress]);

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAddress(val);
    setHasText(val.trim().length > 0);
    setPendingDetails(null);
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(e, pendingDetails);
  };

  return (
    <form
      onSubmit={onFormSubmit}
      className='flex flex-col sm:flex-row gap-3 w-full'
      noValidate
    >
      <div className='flex-grow'>
        <gmp-place-autocomplete ref={autocompleteRef}>
          <input
            ref={inputRef}
            slot='input'
            name='address'
            type='text'
            defaultValue={address}
            onChange={handleManualInput}
            placeholder='Enter a property address'
            className='w-full px-6 py-3 border rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium'
            onFocus={() => setIsFormFocused(true)}
            onBlur={() => setIsFormFocused(false)}
            autoComplete='off'
          />
        </gmp-place-autocomplete>
      </div>

      <button
        type='submit'
        className={`px-8 py-3 rounded-2xl shadow-lg h-[52px] font-black text-[10px] uppercase tracking-widest transition-all
          ${hasText && !isLoading ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
        disabled={isLoading || !hasText}
      >
        {isLoading ? <Loader size='small' /> : 'Analyze'}
      </button>
    </form>
  );
}
