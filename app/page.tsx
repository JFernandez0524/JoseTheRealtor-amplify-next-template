import HeroSection from './components/HeroSection';
import PropertyAnalyzer from './components/PropertyAnalyzer';
import '@aws-amplify/ui-react/styles.css';

// 1. Import your server-side auth function
import { AuthGetCurrentUserServer } from '@/app/utils/amplifyServerUtils.server';

// 2. Make the page an 'async' function
export default async function HomePage() {
  // 3. Fetch the user on the server
  const user = await AuthGetCurrentUserServer();

  return (
    <main className='flex flex-col items-center min-h-screen bg-gray-50 px-6 py-12'>
      {/* 4. Pass the user down as a prop */}
      <HeroSection user={user} />

      {/* PropertyAnalyzer is a self-contained client component, no changes needed */}
      <PropertyAnalyzer />

      <footer className='mt-12 text-sm text-gray-500'>
        © {new Date().getFullYear()} JoseTheRealtor.com
      </footer>
    </main>
  );
}
