'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader } from '@aws-amplify/ui-react';
import { useFormFocus } from '@/app/context/FormFocusContext';

type AnalyzerFormProps = {
  address: string;
  setAddress: (value: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
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

  // Local state to drive the button UI instantly
  const [hasText, setHasText] = useState(false);

  // 1. Sync Prop -> Input Box
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== address) {
      inputRef.current.value = address;
      setHasText(!!address);
    }
  }, [address]);

  // 2. THE FIX: Implement the "New" Place Autocomplete Logic
  useEffect(() => {
    const el = autocompleteRef.current;
    if (!el) return;

    const onPlaceSelect = async (event: any) => {
      console.log('📍 gmp-select Event Fired');

      // In the new API, we get a 'placePrediction' property directly on the event
      // (or sometimes event.detail depending on the exact version loaded, so we check both)
      const prediction = event.placePrediction || event.detail?.placePrediction;

      if (prediction) {
        try {
          // 1. Convert the prediction to a Place object
          const place = prediction.toPlace();

          // 2. We MUST manually fetch the fields we need (New API requirement)
          await place.fetchFields({ fields: ['formattedAddress'] });

          // 3. Get the result
          const fullAddress = place.formattedAddress;
          console.log('✅ Fetched Address:', fullAddress);

          // 4. Update Application State
          if (fullAddress) {
            setAddress(fullAddress);
            setHasText(true);

            // Force update the input box to show the clean address
            if (inputRef.current) {
              inputRef.current.value = fullAddress;
            }
          }
        } catch (err) {
          console.error('Error fetching place details:', err);
        }
      }
    };

    // The new event listener name is strictly 'gmp-select'
    el.addEventListener('gmp-select', onPlaceSelect);

    return () => {
      el.removeEventListener('gmp-select', onPlaceSelect);
    };
  }, [setAddress]);

  // 3. Handle Manual Typing
  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAddress(val);
    setHasText(val.trim().length > 0);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className='flex flex-col sm:flex-row gap-2 w-full'
      // Prevents browser validation issues with Shadow DOM inputs
      noValidate
    >
      <div className='flex-grow'>
        {/* We use the gmp-place-autocomplete web component */}
        <gmp-place-autocomplete ref={autocompleteRef}>
          <input
            ref={inputRef}
            slot='input'
            name='address'
            type='text'
            defaultValue={address}
            onChange={handleManualInput}
            placeholder='Enter a property address'
            className='w-full px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            onFocus={() => setIsFormFocused(true)}
            onBlur={() => setIsFormFocused(false)}
            autoComplete='off'
          />
        </gmp-place-autocomplete>
      </div>

      <button
        type='submit'
        className={`px-6 py-2 rounded-md shadow-sm h-[42px] mt-[1px] font-medium transition-colors
          ${
            hasText && !isLoading
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        disabled={isLoading || !hasText}
      >
        {isLoading ? <Loader size='small' /> : 'Analyze'}
      </button>
    </form>
  );
}
