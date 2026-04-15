'use client';

import { useState } from 'react';

export default function CostBreakdownPage() {
  const [showMargins, setShowMargins] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto space-y-16">

        {/* Hero */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Complete Real Estate Lead Management System
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Everything you need to find, analyze, and convert property leads — from CSV import to CRM sync, skip tracing, and direct mail automation.
          </p>
        </div>

        {/* What You Get */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">What You Get</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '📊', title: 'Lead Dashboard', desc: 'All your leads stored securely in the cloud. Filter by status, AI priority, property type, equity, and more. Real-time updates — no page reloads needed.' },
              { icon: '🔍', title: 'Skip Tracing', desc: 'Find phone numbers, emails, and mailing addresses for property owners. Pay only for successful matches at $0.10/lead.' },
              { icon: '🏦', title: 'Property Enrichment', desc: 'Get real equity percentages, mortgage balances, quality phone numbers (mobile, 90+ score, not DNC), and property flags at $0.35/lead.' },
              { icon: '🔗', title: 'GoHighLevel Sync', desc: 'One-click sync to your GHL account. Leads arrive with tags, Zestimate values, cash offers, and proper routing for dialer or direct mail campaigns.' },
              { icon: '📥', title: 'CSV Import & Export', desc: 'Bulk import leads from any list source. Export skip-traced data with contact info, status, and completion dates for targeted outreach.' },
              { icon: '💰', title: 'Property Valuations', desc: 'Real-time Zestimate data with refresh capability. See property values, age indicators, and click through to Zillow for details.' },
              { icon: '🎯', title: 'Smart Filtering', desc: 'Filter by manual status, AI priority, owner occupied, high equity, skip trace date, property type, and more. Find your best leads instantly.' },
              { icon: '📬', title: 'Direct Mail Automation', desc: 'Automatic Zestimate and cash offer calculation for GHL Click2Mail campaigns. Webhook tracking for delivery and QR code scans.' },
              { icon: '🤖', title: 'AI Lead Scoring', desc: 'Intelligent 0-100 scores based on equity, value, timeline, location, and contact availability. Focus on the hottest leads first.' },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Our Pricing */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Our Pricing</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Sync Plan */}
            <div className="bg-white rounded-xl p-8 shadow-sm border-2 border-blue-500 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">POPULAR</div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Sync Plan</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-gray-900">$49</span>
                <span className="text-gray-500">/month</span>
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2"><span className="text-green-500">✓</span>Connect your GHL account</li>
                <li className="flex gap-2"><span className="text-green-500">✓</span>Automated lead sync to GHL</li>
                <li className="flex gap-2"><span className="text-green-500">✓</span>Advanced lead management</li>
                <li className="flex gap-2"><span className="text-green-500">✓</span>Smart filtering &amp; export</li>
                <li className="flex gap-2"><span className="text-green-500">✓</span>Direct mail workflow automation</li>
                <li className="flex gap-2"><span className="text-green-500">✓</span>Priority support</li>
              </ul>
            </div>

            {/* Skip Trace */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Skip Tracing</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-gray-900">$0.10</span>
                <span className="text-gray-500">/lead</span>
              </div>
              <p className="text-xs text-gray-500 mb-4">Probate leads — pay per successful match</p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2"><span className="text-green-500">✓</span>Phone numbers</li>
                <li className="flex gap-2"><span className="text-green-500">✓</span>Email addresses</li>
                <li className="flex gap-2"><span className="text-green-500">✓</span>Mailing addresses</li>
                <li className="flex gap-2"><span className="text-green-500">✓</span>Basic contact data</li>
              </ul>
              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-700 mb-2">Credit Packages</p>
                <div className="space-y-1 text-xs text-gray-500">
                  <div className="flex justify-between"><span>100 credits</span><span className="font-medium">$10</span></div>
                  <div className="flex justify-between"><span>250 credits</span><span className="font-medium">$25</span></div>
                  <div className="flex justify-between"><span>500 credits</span><span className="font-medium">$50</span></div>
                </div>
              </div>
            </div>

            {/* Enrichment */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Property Enrichment</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-gray-900">$0.35</span>
                <span className="text-gray-500">/lead</span>
              </div>
              <p className="text-xs text-gray-500 mb-4">Preforeclosure leads — complete property data</p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2"><span className="text-green-500">✓</span>Real equity % &amp; mortgage balances</li>
                <li className="flex gap-2"><span className="text-green-500">✓</span>Quality phones (mobile, 90+, not DNC)</li>
                <li className="flex gap-2"><span className="text-green-500">✓</span>Owner emails</li>
                <li className="flex gap-2"><span className="text-green-500">✓</span>Property flags (owner occupied, high equity)</li>
                <li className="flex gap-2"><span className="text-green-500">✓</span>Foreclosure details &amp; lender info</li>
              </ul>
            </div>
          </div>
        </section>

        {/* GHL Companion */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">GoHighLevel — Your Complete CRM</h2>
          <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto">
            Our app + GHL = a complete lead-to-deal system. If you already have GHL, our Sync Plan integrates directly with your existing account.
          </p>
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl">📞</span>
              <div>
                <h3 className="font-bold text-gray-900">GHL Starter Plan</h3>
                <p className="text-sm text-gray-500">Separate subscription — you bring your own GHL account</p>
              </div>
              <span className="ml-auto text-2xl font-bold text-gray-900">$97<span className="text-sm font-normal text-gray-500">/mo</span></span>
            </div>
            <p className="text-xs text-gray-500 mb-6">$81/mo with annual billing. 14-day free trial available.</p>

            <h4 className="text-sm font-semibold text-gray-700 mb-3">Usage-Based Costs (LC Phone / Twilio)</h4>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { label: 'Outbound voice calls', cost: '~$0.017/min' },
                { label: 'SMS messages', cost: '~$0.0075/segment + carrier fees' },
                { label: 'Phone number', cost: '$1.15/mo' },
                { label: 'A2P 10DLC registration', cost: '~$24.50 one-time + $11/mo' },
                { label: 'Answering machine detection', cost: '$0.0075/call' },
                { label: 'Call recording', cost: '$0.0025/min' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-2">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className="text-sm font-medium text-gray-900 whitespace-nowrap ml-2">{item.cost}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Power Dialer:</strong> Built into GHL — uses the voice call rates above. No additional software cost. Our app automatically tags and routes your leads so they&apos;re ready to dial the moment they hit your GHL pipeline.
              </p>
            </div>
          </div>
        </section>

        {/* Thanks.io */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">📮 Thanks.io — Direct Mail (Optional Add-On)</h2>
          <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto">
            Automated handwritten direct mail with QR code tracking. Requires Thanks.io Business plan subscription $50/month.
          </p>
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 max-w-3xl mx-auto">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">Per-Piece Pricing (Business Plan, includes postage)</h4>
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              {[
                { label: '4×6 Postcard', cost: '~$0.73' },
                { label: '6×9 Postcard', cost: '~$0.87' },
                { label: 'Windowed Letter', cost: '~$0.79' },
                { label: 'Windowless Letter', cost: '~$1.31' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-2">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className="text-sm font-medium text-gray-900">{item.cost}</span>
                </div>
              ))}
            </div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">How It Integrates With Our App</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2"><span className="text-green-500">✓</span>Webhook tracking — know exactly when mail is delivered</li>
              <li className="flex gap-2"><span className="text-green-500">✓</span>QR code scan detection — instant hot lead alerts</li>
              <li className="flex gap-2"><span className="text-green-500">✓</span>Automatic pipeline stage updates (Touch 1 → Touch 2 → Touch 3 → Engaged)</li>
              <li className="flex gap-2"><span className="text-green-500">✓</span>Leads without phone numbers auto-tagged for direct mail routing</li>
            </ul>
          </div>
        </section>

        {/* Total Cost Scenarios */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Total Monthly Cost Scenarios</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                title: 'Getting Started',
                subtitle: 'New investor, small list',
                total: '~$171',
                items: [
                  { label: 'Our App (Sync Plan)', cost: '$49' },
                  { label: 'GHL Starter', cost: '$97' },
                  { label: 'GHL add-ons (phone, A2P)', cost: '~$15' },
                  { label: 'Skip credits (100)', cost: '$10' },
                ],
              },
              {
                title: 'Active Investor',
                subtitle: '500 leads/month, regular calling',
                total: '~$226',
                items: [
                  { label: 'Our App (Sync Plan)', cost: '$49' },
                  { label: 'GHL Starter', cost: '$97' },
                  { label: 'GHL usage (calls + SMS)', cost: '~$30' },
                  { label: 'Skip credits (500)', cost: '$50' },
                ],
              },
              {
                title: 'High Volume + Direct Mail',
                subtitle: '500 leads + 200 mailers/month',
                total: '~$372',
                items: [
                  { label: 'Our App (Sync Plan)', cost: '$49' },
                  { label: 'GHL Starter', cost: '$97' },
                  { label: 'GHL usage (calls + SMS)', cost: '~$30' },
                  { label: 'Skip credits (500)', cost: '$50' },
                  { label: 'Thanks.io (200 postcards)', cost: '~$146' },
                ],
              },
            ].map((scenario) => (
              <div key={scenario.title} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-1">{scenario.title}</h3>
                <p className="text-xs text-gray-500 mb-4">{scenario.subtitle}</p>
                <div className="space-y-2 mb-4">
                  {scenario.items.map((item) => (
                    <div key={item.label} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-medium text-gray-900">{item.cost}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-3 flex justify-between">
                  <span className="font-semibold text-gray-900">Estimated Total</span>
                  <span className="text-xl font-bold text-blue-600">{scenario.total}<span className="text-sm font-normal text-gray-500">/mo</span></span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Internal Margin Summary (collapsible) */}
        <section className="max-w-3xl mx-auto">
          <button
            onClick={() => setShowMargins(!showMargins)}
            className="w-full flex items-center justify-between bg-gray-800 text-white rounded-xl px-6 py-4 hover:bg-gray-700 transition-colors"
          >
            <span className="font-semibold">🔒 Internal: Unit Economics &amp; Margins</span>
            <span className="text-xl">{showMargins ? '−' : '+'}</span>
          </button>
          {showMargins && (
            <div className="bg-gray-900 text-gray-100 rounded-b-xl px-6 py-6 -mt-2 space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Per-Transaction Margins</h4>
                <div className="space-y-2">
                  {[
                    { label: 'Skip Trace (probate)', yourCost: '$0.07', userPays: '$0.10', margin: '$0.03 (43%)' },
                    { label: 'Enrichment (preforeclosure)', yourCost: '$0.29', userPays: '$0.35', margin: '$0.06 (17%)' },
                  ].map((row) => (
                    <div key={row.label} className="grid grid-cols-4 gap-2 text-sm bg-gray-800 rounded-lg px-4 py-2">
                      <span className="text-gray-300">{row.label}</span>
                      <span className="text-center">Cost: {row.yourCost}</span>
                      <span className="text-center">Charge: {row.userPays}</span>
                      <span className="text-right text-green-400 font-medium">{row.margin}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Subscription Margin</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between bg-gray-800 rounded-lg px-4 py-2">
                    <span className="text-gray-300">Sync Plan revenue</span>
                    <span>$49/mo</span>
                  </div>
                  <div className="flex justify-between bg-gray-800 rounded-lg px-4 py-2">
                    <span className="text-gray-300">AWS costs (Amplify, DynamoDB, Lambda, S3)</span>
                    <span>~$5–15/mo</span>
                  </div>
                  <div className="flex justify-between bg-gray-800 rounded-lg px-4 py-2">
                    <span className="text-gray-300">Estimated margin per subscriber</span>
                    <span className="text-green-400 font-medium">~$34–44/mo</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Other Costs</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between bg-gray-800 rounded-lg px-4 py-2">
                    <span className="text-gray-300">Bridge API (Zestimate)</span>
                    <span>Free</span>
                  </div>
                  <div className="flex justify-between bg-gray-800 rounded-lg px-4 py-2">
                    <span className="text-gray-300">Google Maps (address validation)</span>
                    <span>~$5/1,000 geocodes</span>
                  </div>
                  <div className="flex justify-between bg-gray-800 rounded-lg px-4 py-2">
                    <span className="text-gray-300">Stripe processing</span>
                    <span>2.9% + $0.30/txn (absorbed)</span>
                  </div>
                  <div className="flex justify-between bg-gray-800 rounded-lg px-4 py-2">
                    <span className="text-gray-300">OpenAI (AI outreach — paused)</span>
                    <span>$0 currently</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
