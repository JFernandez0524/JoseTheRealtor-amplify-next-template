import HeroSection from './components/HeroSection';
import PropertyAnalyzer from './components/PropertyAnalyzer';
import { FeatureCard } from './components/shared/FeatureCard';
import { StatCard } from './components/shared/StatCard';
import { Section } from './components/shared/Section';
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
    <main className='min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50'>
      {/* 3. Wrap your client components in the Provider */}
      <FormFocusProvider>
        {/* Hero and Analyzer Section */}
        <section className='py-20 px-6'>
          <div className='max-w-6xl mx-auto flex flex-col items-center justify-center gap-12'>
            {/* Pass the server-fetched user as a prop */}
            <HeroSection user={user} />

            {/* This component will get focus state from the context */}
            <PropertyAnalyzer user={user} />
          </div>
        </section>

        {/* Features Section */}
        <Section>
          <div className='text-center mb-12'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>
              Everything You Need for Real Estate Success
            </h2>
            <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
              Streamline your lead management with automated tools that save time and increase conversions
            </p>
          </div>

          <div className='grid md:grid-cols-3 gap-8'>
            <FeatureCard
              icon="📊"
              title="Smart Lead Import"
              description="Upload CSV files and automatically validate addresses, fetch property values, and detect counties using Google Maps and Zillow APIs."
            />
            <FeatureCard
              icon="🔍"
              title="Skip Tracing"
              description="Find contact information for property owners at just $0.10 per successful trace. Download results with completion dates for targeted outreach."
              gradient="from-green-500 to-green-600"
            />
            <FeatureCard
              icon="🔗"
              title="CRM Integration"
              description="Seamlessly sync qualified leads to GoHighLevel with property values and custom tags for automated workflow triggers."
              gradient="from-purple-500 to-purple-600"
            />
          </div>
        </Section>

        {/* Stats Section */}
        <Section background="dark">
          <div className='text-center mb-12'>
            <h2 className='text-3xl font-bold mb-4'>Trusted by Real Estate Professionals</h2>
            <p className='text-gray-300 text-lg'>Join thousands of agents who are closing more deals</p>
          </div>
          
          <div className='grid md:grid-cols-4 gap-8'>
            <StatCard value="10K+" label="Leads Processed" color="text-blue-400" />
            <StatCard value="95%" label="Address Accuracy" color="text-green-400" />
            <StatCard value="$0.10" label="Per Skip Trace" color="text-purple-400" />
            <StatCard value="24/7" label="Platform Access" color="text-yellow-400" />
          </div>
        </Section>
      </FormFocusProvider>

      <footer className='bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 border-t border-gray-200'>
        <div className='max-w-7xl mx-auto text-center'>
          <p className='text-gray-600'>
            © {new Date().getFullYear()} JoseTheRealtor.com - Streamlining Real Estate Lead Management
          </p>
        </div>
      </footer>
    </main>
  );
}
