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
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:py-12">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto px-4">
            Start with our free tier and upgrade as your real estate business grows. 
            Skip tracing credits are purchased separately at $0.10 per skip.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto px-4">
          {plans.map((plan) => (
            <PricingCard key={plan.planId} {...plan} />
          ))}
        </div>

        {/* Skip Tracing Packages */}
        <div className="mt-12 sm:mt-16 px-4">
          <div className="bg-white rounded-lg p-6 sm:p-8 max-w-4xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
              Skip Tracing Credit Packages
            </h2>
            <p className="text-gray-600 text-center mb-6 sm:mb-8 text-sm sm:text-base">
              Purchase skip tracing credits at $0.10 per skip. Credits never expire for PRO members.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {skipPackages.map((pkg) => (
                <div key={pkg.credits} className="border border-gray-200 rounded-lg p-4 sm:p-6 text-center hover:border-blue-500 transition-colors">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                    {pkg.credits} Credits
                  </h3>
                  <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-2">
                    {pkg.price}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 mb-4">
                    {pkg.perCredit} per skip
                  </div>
                  <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-600 transition-colors text-sm sm:text-base">
                    Buy Credits
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 sm:mt-16 text-center px-4">
          <div className="bg-white rounded-lg p-6 sm:p-8 max-w-4xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
              Plan Comparison
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 text-left">
              <div className="border-l-4 border-blue-500 pl-4 sm:pl-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                  SYNC PLAN ($97/month)
                </h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4">
                  Perfect for agents who want to manage their own outreach. Connect your 
                  GoHighLevel account and get pre-built workflows for manual calling, 
                  texting, and direct mail campaigns.
                </p>
                <div className="text-blue-600 font-medium text-sm sm:text-base">✓ Manual outreach workflows included</div>
              </div>
              
              <div className="border-l-4 border-purple-500 pl-4 sm:pl-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                  AI OUTREACH PLAN ($250/month)
                </h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4">
                  Fully automated lead outreach with our AI text agent. Set it and 
                  forget it - our AI handles conversations, follow-ups, and lead 
                  qualification automatically.
                </p>
                <div className="text-purple-600 font-medium text-sm sm:text-base">✓ Automated AI text agent included</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
