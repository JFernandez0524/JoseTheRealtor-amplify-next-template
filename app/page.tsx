import HeroSection from './components/HeroSection';
import PropertyAnalyzer from './components/PropertyAnalyzer';
import '@aws-amplify/ui-react/styles.css';

// 1. Import your server-side auth function
import { AuthGetCurrentUserServer } from '@/app/utils/aws/auth/amplifyServerUtils.server'; // Adjust path if needed
// 2. Import the new Provider
import { FormFocusProvider } from '@/app/context/FormFocusContext'; // Adjust path if needed

// Page MUST be an 'async' Server Component
export default async function HomePage() {
  // Fetch the user on the server
  const user = await AuthGetCurrentUserServer();

  return (
    <main className='flex flex-col items-center min-h-screen bg-gray-50 px-4 sm:px-6 py-6 sm:py-12'>
      {/* 3. Wrap your client components in the Provider */}
      <FormFocusProvider>
        {/* Pass the server-fetched user as a prop */}
        <HeroSection user={user} />

        {/* This component will get focus state from the context */}
        <PropertyAnalyzer user={user} />
      </FormFocusProvider>

      <footer className='mt-8 sm:mt-12 text-xs sm:text-sm text-gray-500 text-center px-4'>
        © {new Date().getFullYear()} JoseTheRealtor.com
      </footer>
    </main>
  );
}
