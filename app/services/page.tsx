import { FeatureCard } from '../components/shared/FeatureCard';
import { Section } from '../components/shared/Section';
import { CTAButton } from '../components/shared/CTAButton';

export default async function ServicesPage() {
  return (
    <main className='min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50'>
      {/* Hero Section */}
      <section className='py-20 px-6'>
        <div className='max-w-4xl mx-auto text-center'>
          <h1 className='text-5xl font-black text-slate-900 mb-6 tracking-tight'>
            Comprehensive Real Estate
            <span className='text-blue-600'> Lead Solutions</span>
          </h1>
          <p className='text-xl text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed'>
            From lead import to CRM integration, we provide everything you need to streamline your real estate investment workflow
          </p>
        </div>
      </section>

      {/* Main Services */}
      <Section>
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-12'>
          <FeatureCard
            icon="📊"
            title="Smart Lead Management"
            description="Upload CSV files and watch our system automatically validate addresses, fetch property values, and organize your leads for easy filtering and management."
            features={[
              "Automatic address validation",
              "Property value estimation", 
              "County detection",
              "Duplicate prevention"
            ]}
            gradient="from-blue-500 to-blue-600"
          />
          
          <FeatureCard
            icon="🔍"
            title="Professional Skip Tracing"
            description="Find accurate contact information for property owners at industry-leading rates. Download results with completion tracking for targeted campaigns."
            features={[
              "$0.10 per successful trace",
              "Phone numbers & email addresses",
              "Date-filtered downloads", 
              "Bulk processing available"
            ]}
            gradient="from-green-500 to-green-600"
          />

          <FeatureCard
            icon="🏦"
            title="Property Enrichment"
            description="Get real property data for preforeclosure leads including equity, mortgage balances, and quality contact info to identify your best opportunities."
            features={[
              "Real equity & mortgage data",
              "Owner occupied & high equity flags",
              "Quality phone numbers & emails",
              "Foreclosure & lender details"
            ]}
            gradient="from-teal-500 to-teal-600"
          />
          
          <FeatureCard
            icon="🔗"
            title="GoHighLevel Integration"
            description="Seamlessly sync qualified leads to your GoHighLevel CRM with property values, contact information, and custom tags for workflow automation."
            features={[
              "One-click lead sync",
              "Custom tag management",
              "Persistent connection",
              "Workflow automation ready"
            ]}
            gradient="from-purple-500 to-purple-600"
          />
        </div>
      </Section>

      {/* CTA Section */}
      <Section>
        <div className='text-center'>
          <h2 className='text-4xl font-bold text-slate-900 mb-6'>
            Ready to Transform Your Lead Management?
          </h2>
          <p className='text-xl text-slate-600 mb-8 max-w-2xl mx-auto'>
            Join thousands of real estate professionals who are closing more deals with our comprehensive platform
          </p>
          <div className='flex flex-col sm:flex-row gap-4 justify-center'>
            <CTAButton href='/pricing' variant='primary'>
              View Pricing Plans
            </CTAButton>
            <CTAButton href='/dashboard' variant='secondary'>
              Try Free Demo
            </CTAButton>
          </div>
        </div>
      </Section>
    </main>
  );
}
