'use client';

import PricingCard from '../components/pricing/PricingCard';

export default function PricingPage() {
  const plans = [
    {
      title: 'FREE',
      price: 'Free',
      planId: 'free',
      features: [
        '5 starter skip tracing credits',
        'Basic lead management',
        'Property analyzer',
        'CSV lead import',
        'Purchase additional skip credits',
        '30-day credit expiration',
        '1 account per IP'
      ]
    },
    {
      title: 'SYNC PLAN',
      price: '$97',
      planId: 'sync-plan',
      popular: true,
      features: [
        'Advanced lead management',
        'Connect your GHL account',
        'Automated lead sync to GHL',
        'Manual outreach workflows (call/text)',
        'Direct mail workflow automation',
        'Advanced filtering & export',
        'Priority support',
        'Buy skip credits separately'
      ]
    },
    {
      title: 'AI OUTREACH PLAN',
      price: '$250',
      planId: 'ai-outreach',
      features: [
        'Everything in SYNC PLAN',
        'Automated text agent outreach',
        'AI-powered lead follow-ups',
        'Smart conversation management',
        'Automated response handling',
        'Advanced AI analytics',
        'Custom AI workflows',
        'Dedicated account management'
      ]
    }
  ];

  const skipPackages = [
    { credits: 100, price: '$10', perCredit: '$0.10' },
    { credits: 250, price: '$25', perCredit: '$0.10' },
    { credits: 500, price: '$50', perCredit: '$0.10' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Start with our free tier and upgrade as your real estate business grows. 
            Skip tracing credits are purchased separately at $0.10 per skip.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <PricingCard key={plan.planId} {...plan} />
          ))}
        </div>

        {/* Skip Tracing Packages */}
        <div className="mt-16">
          <div className="bg-white rounded-lg p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Skip Tracing Credit Packages
            </h2>
            <p className="text-gray-600 text-center mb-8">
              Purchase skip tracing credits at $0.10 per skip. Credits never expire for PRO members.
            </p>
            
            <div className="grid md:grid-cols-3 gap-6">
              {skipPackages.map((pkg) => (
                <div key={pkg.credits} className="border border-gray-200 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {pkg.credits} Credits
                  </h3>
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {pkg.price}
                  </div>
                  <div className="text-sm text-gray-500 mb-4">
                    {pkg.perCredit} per skip
                  </div>
                  <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-600 transition-colors">
                    Buy Credits
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <div className="bg-white rounded-lg p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Plan Comparison
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8 text-left">
              <div className="border-l-4 border-blue-500 pl-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  SYNC PLAN ($97/month)
                </h3>
                <p className="text-gray-600 mb-4">
                  Perfect for agents who want to manage their own outreach. Connect your 
                  GoHighLevel account and get pre-built workflows for manual calling, 
                  texting, and direct mail campaigns.
                </p>
                <div className="text-blue-600 font-medium">✓ Manual outreach workflows included</div>
              </div>
              
              <div className="border-l-4 border-purple-500 pl-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  AI OUTREACH PLAN ($250/month)
                </h3>
                <p className="text-gray-600 mb-4">
                  Fully automated lead outreach with our AI text agent. Set it and 
                  forget it - our AI handles conversations, follow-ups, and lead 
                  qualification automatically.
                </p>
                <div className="text-purple-600 font-medium">✓ Automated AI text agent included</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
