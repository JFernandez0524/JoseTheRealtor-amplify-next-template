'use client';

import { useState } from 'react';

interface PricingCardProps {
  title: string;
  price: string;
  features: string[];
  planId: string;
  popular?: boolean;
  ghlIncluded?: boolean;
}

export default function PricingCard({ 
  title, 
  price, 
  features, 
  planId, 
  popular = false,
  ghlIncluded = false 
}: PricingCardProps) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });

      const { checkoutUrl } = await response.json();
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Checkout error:', error);
      setLoading(false);
    }
  };

  return (
    <div className={`relative rounded-2xl p-8 ${
      popular 
        ? 'border-2 border-purple-500 bg-purple-50' 
        : 'border border-gray-200 bg-white'
    }`}>
      {popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-medium">
            Most Popular
          </span>
        </div>
      )}

      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
        <div className="mb-6">
          <span className="text-4xl font-bold text-gray-900">{price}</span>
          {price !== 'Free' && <span className="text-gray-500">/month</span>}
        </div>

        {ghlIncluded && (
          <div className="mb-4 p-3 bg-green-100 rounded-lg">
            <div className="text-green-800 font-medium text-sm">
              🚀 Includes Managed GoHighLevel Account
            </div>
            <div className="text-green-600 text-xs mt-1">
              No separate GHL subscription needed
            </div>
          </div>
        )}

        <ul className="space-y-3 mb-8 text-left">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-700">{feature}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={handleSubscribe}
          disabled={loading || planId === 'free'}
          className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
            popular
              ? 'bg-purple-500 text-white hover:bg-purple-600'
              : planId === 'free'
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          {loading ? 'Loading...' : planId === 'free' ? 'Current Plan' : 'Get Started'}
        </button>
      </div>
    </div>
  );
}
