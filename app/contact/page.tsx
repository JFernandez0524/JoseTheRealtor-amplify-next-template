import type { Metadata } from 'next';
import { Section } from '../components/shared/Section';
import { FeatureCard } from '../components/shared/FeatureCard';

export const metadata: Metadata = {
  title: 'Contact Us | JoseTheRealtor',
  description: 'Get in touch with our support team for help with lead management, technical issues, or general inquiries.',
};

export default function ContactPage() {
  return (
    <main className='min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50'>
      {/* Hero Section */}
      <Section>
        <div className='text-center mb-16'>
          <h1 className='text-4xl font-bold text-gray-900 mb-6'>
            Get in Touch
          </h1>
          <p className='text-xl text-gray-600 max-w-2xl mx-auto'>
            Our support team is here to help you succeed with your real estate lead management
          </p>
        </div>

        {/* Contact Methods */}
        <div className='grid md:grid-cols-3 gap-8 mb-16'>
          <FeatureCard
            icon="📧"
            title="Email Support"
            description="Get detailed help with technical issues, account questions, or feature requests."
            gradient="from-blue-500 to-blue-600"
          />
          <FeatureCard
            icon="💬"
            title="Live Chat"
            description="Quick answers to your questions directly in the dashboard. Available for all users."
            gradient="from-green-500 to-green-600"
          />
          <FeatureCard
            icon="📞"
            title="Priority Support"
            description="Phone support and dedicated assistance for SYNC PLAN and AI OUTREACH PLAN subscribers."
            gradient="from-purple-500 to-purple-600"
          />
        </div>

        {/* Contact Form */}
        <div className='max-w-2xl mx-auto'>
          <div className='bg-white p-8 rounded-xl shadow-lg border border-gray-100'>
            <h2 className='text-2xl font-semibold text-gray-900 mb-6 text-center'>Send Us a Message</h2>
            
            <form className='space-y-6'>
              <div className='grid md:grid-cols-2 gap-6'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    First Name *
                  </label>
                  <input
                    type='text'
                    required
                    className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
                    placeholder='Your first name'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    Last Name *
                  </label>
                  <input
                    type='text'
                    required
                    className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
                    placeholder='Your last name'
                  />
                </div>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Email Address *
                </label>
                <input
                  type='email'
                  required
                  className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
                  placeholder='your@email.com'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Subject *
                </label>
                <select
                  required
                  className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
                >
                  <option value=''>Select a topic</option>
                  <option value='technical'>Technical Support</option>
                  <option value='billing'>Billing & Account</option>
                  <option value='feature'>Feature Request</option>
                  <option value='ghl'>GoHighLevel Integration</option>
                  <option value='general'>General Inquiry</option>
                </select>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Message *
                </label>
                <textarea
                  required
                  rows={6}
                  className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none'
                  placeholder='Please describe your question or issue in detail...'
                />
              </div>

              <button
                type='submit'
                className='w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors'
              >
                Send Message
              </button>
            </form>
          </div>
        </div>
      </Section>

      {/* FAQ Section */}
      <Section background="light" className="bg-gray-50">
        <div className='text-center mb-12'>
          <h2 className='text-3xl font-bold text-gray-900 mb-4'>Frequently Asked Questions</h2>
          <p className='text-gray-600'>Quick answers to common questions</p>
        </div>

        <div className='max-w-3xl mx-auto space-y-6'>
          <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-100'>
            <h3 className='font-semibold text-gray-900 mb-2'>How accurate is the skip tracing?</h3>
            <p className='text-gray-600 text-sm'>Our skip tracing service has a high success rate and only charges for successful matches. You only pay $0.10 when we find valid contact information.</p>
          </div>
          
          <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-100'>
            <h3 className='font-semibold text-gray-900 mb-2'>Can I connect multiple GoHighLevel accounts?</h3>
            <p className='text-gray-600 text-sm'>Currently, each user account can connect to one GHL location. The connection persists across login sessions and includes automatic token refresh.</p>
          </div>
          
          <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-100'>
            <h3 className='font-semibold text-gray-900 mb-2'>What file formats do you support for lead import?</h3>
            <p className='text-gray-600 text-sm'>We support CSV files with specific column requirements. Check our User Guide for detailed formatting instructions and required fields.</p>
          </div>
          
          <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-100'>
            <h3 className='font-semibold text-gray-900 mb-2'>Do credits expire?</h3>
            <p className='text-gray-600 text-sm'>Yes, skip tracing credits expire after 30 days to ensure data freshness. Paid plan subscribers get additional benefits and longer credit validity.</p>
          </div>
        </div>
      </Section>

      {/* Contact Info */}
      <Section background="dark">
        <div className='text-center'>
          <h2 className='text-3xl font-bold mb-8'>Contact Information</h2>
          <div className='grid md:grid-cols-3 gap-8 max-w-4xl mx-auto'>
            <div>
              <div className='text-4xl mb-4'>📧</div>
              <h3 className='text-lg font-semibold mb-2'>Email</h3>
              <p className='text-gray-300'>support@josetherealtor.com</p>
            </div>
            <div>
              <div className='text-4xl mb-4'>⏰</div>
              <h3 className='text-lg font-semibold mb-2'>Response Time</h3>
              <p className='text-gray-300'>Within 24 hours</p>
            </div>
            <div>
              <div className='text-4xl mb-4'>🌍</div>
              <h3 className='text-lg font-semibold mb-2'>Availability</h3>
              <p className='text-gray-300'>Monday - Friday, 9 AM - 6 PM EST</p>
            </div>
          </div>
        </div>
      </Section>
    </main>
  );
}
