'use client';

import { useState, useRef } from 'react';
import { Loader } from '@aws-amplify/ui-react';
import { Autocomplete } from '@react-google-maps/api'; // 👈 Using the React library wrapper
import { useFormFocus } from '@/app/context/FormFocusContext';

type AnalyzerFormProps = {
  address: string;
  setAddress: (value: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
};

export default function AnalyzerForm({
  address,
  setAddress,
  handleSubmit,
  isLoading,
}: AnalyzerFormProps) {
  const { setIsFormFocused } = useFormFocus();

  // We store the Google Autocomplete instance here when it loads
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);

  // 1. When the component loads, capture the instance
  const onConstantsLoad = (
    autocompleteInstance: google.maps.places.Autocomplete
  ) => {
    setAutocomplete(autocompleteInstance);
  };

  // 2. When a user selects a place from the dropdown
  const onPlaceChanged = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace();

      // Get the clean address or fallback to name
      const formattedAddress = place.formatted_address || place.name;

      if (formattedAddress) {
        setAddress(formattedAddress);
      }
    }
  };

  // 3. Handle manual typing (standard React way)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className='flex flex-col sm:flex-row gap-2 w-full'
    >
      <div className='flex-grow'>
        {/* This Component wraps the input and handles the Google integration for us.
          It ensures React events and Google events don't conflict.
        */}
        <Autocomplete onLoad={onConstantsLoad} onPlaceChanged={onPlaceChanged}>
          <input
            type='text'
            name='address'
            value={address}
            onChange={handleInputChange}
            placeholder='Enter a property address'
            className='w-full px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            onFocus={() => setIsFormFocused(true)}
            onBlur={() => setIsFormFocused(false)}
            // Standard Inputs don't crash the browser validation, so we can use required if we want,
            // but your disabled button logic handles it better.
          />
        </Autocomplete>
      </div>

      <button
        type='submit'
        className={`px-6 py-2 rounded-md shadow-sm h-[42px] mt-[1px] font-medium transition-colors
          ${
            !isLoading && address.trim().length > 0
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        disabled={isLoading || address.trim().length === 0}
      >
        {isLoading ? <Loader size='small' /> : 'Analyze'}
      </button>
    </form>
  );
}
