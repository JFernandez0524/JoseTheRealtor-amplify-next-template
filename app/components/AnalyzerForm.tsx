'use client';

import { useEffect, useRef } from 'react';
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
        React.HTMLAttributes<HTMLElement>,
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

  useEffect(() => {
    if (autocompleteRef.current && address !== autocompleteRef.current.value) {
      autocompleteRef.current.value = address;
    }
  }, [address]);

  useEffect(() => {
    const el = autocompleteRef.current;
    if (!el) return;

    const handleSelect = (e: any) => {
      const place = e.detail.place;
      if (place && place.formatted_address) {
        setAddress(place.formatted_address);
      }
    };

    el.addEventListener('gmp-places-select', handleSelect);
    return () => {
      el.removeEventListener('gmp-places-select', handleSelect);
    };
  }, [setAddress]);

  return (
    <form
      onSubmit={handleSubmit}
      className='flex flex-col sm:flex-row gap-2 w-full'
    >
      <div className='flex-grow'>
        <gmp-place-autocomplete ref={autocompleteRef}>
          <input
            slot='input'
            type='text'
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder='Enter a property address'
            className='w-full px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            required
            onFocus={() => setIsFormFocused(true)}
            onBlur={() => setIsFormFocused(false)}
          />
        </gmp-place-autocomplete>
      </div>
      <button
        type='submit'
        className='bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400 h-[42px] mt-[1px]'
        disabled={isLoading}
      >
        {isLoading ? <Loader /> : 'Analyze'}
      </button>
    </form>
  );
}
