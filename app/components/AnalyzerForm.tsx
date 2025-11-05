'use client';

import { Loader } from '@aws-amplify/ui-react';
import { Autocomplete } from '@react-google-maps/api';
import { useFormFocus } from '@/app/context/FormFocusContext'; // Adjust path

// Define the props this component needs
type AnalyzerFormProps = {
  address: string;
  setAddress: (value: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  onLoad: (autocomplete: any) => void; // Using 'any' for the Google Autocomplete type
  onPlaceChanged: () => void;
};

export default function AnalyzerForm({
  address,
  setAddress,
  handleSubmit,
  isLoading,
  onLoad,
  onPlaceChanged,
}: AnalyzerFormProps) {
  const { setIsFormFocused } = useFormFocus();

  return (
    <form
      onSubmit={handleSubmit}
      className='flex flex-col sm:flex-row gap-2 w-full'
    >
      <Autocomplete
        onLoad={onLoad}
        onPlaceChanged={onPlaceChanged}
        className='flex-grow'
      >
        <input
          type='text'
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder='Enter a property address'
          className='w-full px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          required
          onFocus={() => setIsFormFocused(true)}
          onBlur={() => setIsFormFocused(false)}
        />
      </Autocomplete>
      <button
        type='submit'
        className='bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400'
        disabled={isLoading}
      >
        {isLoading ? <Loader /> : 'Analyze'}
      </button>
    </form>
  );
}
