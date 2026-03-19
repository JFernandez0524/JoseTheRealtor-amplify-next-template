import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | JoseTheRealtor',
  description: 'Terms of Service for JoseTheRealtor lead management platform',
};

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Terms of Service</h1>
          <p className="text-sm text-gray-500 mb-6">Last Updated: March 19, 2026</p>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-lg text-gray-700 mb-6">
              These Terms of Service govern your use of JoseTheRealtor's lead management platform and services. 
              By using our services, you agree to these terms and our data usage policies.
            </p>
          </div>
        </div>

        {/* Table of Contents */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Table of Contents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <a href="#services" className="text-blue-600 hover:text-blue-800">1. Services</a>
            <a href="#license" className="text-blue-600 hover:text-blue-800">2. License</a>
            <a href="#fees" className="text-blue-600 hover:text-blue-800">3. Fees and Payment</a>
            <a href="#term" className="text-blue-600 hover:text-blue-800">4. Term</a>
            <a href="#obligations" className="text-blue-600 hover:text-blue-800">5. Customer Obligations</a>
            <a href="#restrictions" className="text-blue-600 hover:text-blue-800">6. Data Usage Restrictions</a>
            <a href="#disclaimers" className="text-blue-600 hover:text-blue-800">7. Data Disclaimers</a>
            <a href="#ai-services" className="text-blue-600 hover:text-blue-800">8. AI Services</a>
            <a href="#integrations" className="text-blue-600 hover:text-blue-800">9. Third-Party Integrations</a>
            <a href="#indemnification" className="text-blue-600 hover:text-blue-800">10. Indemnification</a>
            <a href="#liability" className="text-blue-600 hover:text-blue-800">11. Limitation of Liability</a>
            <a href="#governing-law" className="text-blue-600 hover:text-blue-800">12. Governing Law</a>
          </div>
        </div>

        {/* Terms Content */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="prose prose-gray max-w-none space-y-8">
            
            {/* Section 1: Services */}
            <section id="services">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Services</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">1.1 General</h3>
              <p className="mb-4">
                JoseTheRealtor provides a lead management platform for real estate professionals, including property lead analysis, 
                skip tracing, CRM integration, and automated messaging services. Our services are intended for business use only 
                and may not be used for residential purposes or by persons under 18 years of age.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">1.2 Subscription Plans</h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>FREE Plan:</strong> 5 starter credits with ability to purchase additional skip trace credits</li>
                <li><strong>SYNC PLAN ($97/month):</strong> GoHighLevel integration with manual outreach workflows</li>
                <li><strong>AI OUTREACH PLAN ($250/month):</strong> Automated AI messaging plus all SYNC features</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">1.3 Skip Trace Credits</h3>
              <p className="mb-4">
                Skip trace services are available at $0.10 per lead. Credit packages: 100 credits ($10), 250 credits ($25), 
                500 credits ($50). Credits expire after 12 months of inactivity.
              </p>
            </section>

            {/* Section 2: License */}
            <section id="license">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. License</h2>
              <p className="mb-4">
                Subject to your compliance with these Terms and payment of applicable fees, we grant you a limited, 
                non-exclusive, non-transferable license to access and use our services for your internal business purposes only.
              </p>
              <p className="mb-4">
                You may not: (a) modify or create derivative works; (b) reverse engineer our software; (c) use our services 
                for competitive analysis; (d) resell, redistribute, or sublicense our services or data; or (e) use our services 
                in violation of applicable laws.
              </p>
            </section>

            {/* Section 3: Fees and Payment */}
            <section id="fees">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Fees and Payment</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">3.1 Subscription Fees</h3>
              <p className="mb-4">
                Subscription fees are charged monthly in advance. You authorize us to charge your payment method automatically 
                on each billing date. You must provide current, complete payment information.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">3.2 Skip Trace Charges</h3>
              <p className="mb-4">
                Skip trace services are charged per successful result at $0.10 per lead. Any updated information constitutes 
                a successful result and will be charged accordingly.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">3.3 Refunds</h3>
              <p className="mb-4">
                Subscription fees and skip trace credits are non-refundable. Unused credits expire after 12 months of account inactivity.
              </p>
            </section>

            {/* Section 4: Term */}
            <section id="term">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Term</h2>
              <p className="mb-4">
                This Agreement begins when you accept these terms and continues until terminated. Subscriptions automatically 
                renew unless cancelled. Either party may terminate for material breach with 3 days written notice to cure.
              </p>
            </section>

            {/* Section 5: Customer Obligations */}
            <section id="obligations">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Customer Obligations</h2>
              <p className="mb-4">You represent, warrant, and covenant that:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>All information you provide is accurate and complete</li>
                <li>You will obtain all required consents for communications using our data</li>
                <li>You will honor all opt-outs and consent revocations</li>
                <li>You will comply with all applicable laws including DNC, TCPA, and CAN-SPAM</li>
                <li>You will use our services only for legitimate business purposes</li>
                <li>You will not violate any person's privacy or publicity rights</li>
              </ul>
            </section>

            {/* Section 6: Data Usage Restrictions */}
            <section id="restrictions">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Data Usage Restrictions</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">6.1 FCRA Compliance</h3>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <p className="font-semibold text-yellow-800">
                  IMPORTANT: You are expressly prohibited from using our services or any data for purposes that would 
                  constitute a "consumer report" under the Fair Credit Reporting Act (FCRA). This includes using data 
                  for credit, insurance, employment, or background check purposes.
                </p>
              </div>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">6.2 Legal Compliance</h3>
              <p className="mb-4">
                You are solely responsible for compliance with all applicable laws including:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Do-Not-Call (DNC) registry requirements</li>
                <li>Telephone Consumer Protection Act (TCPA)</li>
                <li>CAN-SPAM Act for email communications</li>
                <li>State and local privacy and solicitation laws</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">6.3 Prohibited Uses</h3>
              <p className="mb-4">You may not:</p>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Resell, redistribute, or sublicense our data or services</li>
                <li>Use our services for competitive analysis or product development</li>
                <li>Create derivative databases or datasets</li>
                <li>Access data without proper authorization</li>
                <li>Use automated tools to scrape or extract data</li>
              </ul>
            </section>

            {/* Section 7: Data Disclaimers */}
            <section id="disclaimers">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Data Disclaimers</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">7.1 Third-Party Data Sources</h3>
              <p className="mb-4">
                Our services rely on third-party data providers including BatchData, public records, and other sources. 
                We are not the originator of this data and cannot guarantee its accuracy, completeness, or timeliness.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">7.2 No Warranties</h3>
              <div className="bg-gray-50 border border-gray-200 p-4 mb-4">
                <p className="font-semibold text-gray-800 mb-2">
                  OUR SERVICES ARE PROVIDED "AS-IS" WITHOUT WARRANTIES OF ANY KIND.
                </p>
                <p className="text-gray-700">
                  We disclaim all warranties, express or implied, including warranties of merchantability, 
                  fitness for a particular purpose, and non-infringement. We do not warrant that our services 
                  will be uninterrupted, error-free, or meet your requirements.
                </p>
              </div>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">7.3 Consent and Opt-Outs</h3>
              <p className="mb-4">
                We do not warrant that we have obtained consent from individuals whose data may be included in our services. 
                You are responsible for obtaining all required consents and honoring opt-out requests.
              </p>
            </section>

            {/* Section 8: AI Services */}
            <section id="ai-services">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. AI Services</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">8.1 Automated Messaging</h3>
              <p className="mb-4">
                Our AI services provide automated messaging across SMS, email, Facebook, Instagram, and WhatsApp. 
                Messages are sent during business hours (Mon-Fri 9AM-7PM, Sat 9AM-12PM EST) with rate limiting.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">8.2 AI Limitations</h3>
              <p className="mb-4">
                AI responses are generated automatically and may not always be appropriate. You remain responsible 
                for all communications sent through our platform and must monitor AI interactions for compliance.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">8.3 Human Oversight</h3>
              <p className="mb-4">
                AI services are designed to hand off qualified leads to human agents. You must provide appropriate 
                human oversight and intervention when needed.
              </p>
            </section>

            {/* Section 9: Third-Party Integrations */}
            <section id="integrations">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Third-Party Integrations</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">9.1 GoHighLevel Integration</h3>
              <p className="mb-4">
                Our GoHighLevel integration allows syncing of leads and automated campaigns. You are responsible 
                for maintaining your GHL account and complying with their terms of service.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">9.2 Thanks.io Direct Mail</h3>
              <p className="mb-4">
                Direct mail services through Thanks.io are subject to their terms and conditions. We are not 
                responsible for mail delivery, quality, or compliance issues.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">9.3 Third-Party Availability</h3>
              <p className="mb-4">
                Third-party integrations may be discontinued or modified at any time. We are not liable for 
                disruptions to third-party services.
              </p>
            </section>

            {/* Section 10: Indemnification */}
            <section id="indemnification">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Indemnification</h2>
              <p className="mb-4">
                You agree to defend, indemnify, and hold us harmless from any claims, damages, losses, or expenses 
                arising from: (a) your use of our services; (b) your violation of these terms; (c) your violation 
                of applicable laws; or (d) unauthorized use of your account.
              </p>
            </section>

            {/* Section 11: Limitation of Liability */}
            <section id="liability">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Limitation of Liability</h2>
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                <p className="font-semibold text-red-800 mb-2">IMPORTANT LIABILITY LIMITATION</p>
                <p className="text-red-700">
                  Our total liability for any claims shall not exceed the amount you paid us in the 12 months 
                  preceding the claim. We are not liable for indirect, incidental, special, or consequential damages, 
                  including loss of profits, data, or business opportunities.
                </p>
              </div>
            </section>

            {/* Section 12: Governing Law */}
            <section id="governing-law">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Governing Law</h2>
              <p className="mb-4">
                These Terms are governed by the laws of the State of Florida. Any disputes shall be resolved in 
                the state or federal courts of Miami-Dade County, Florida.
              </p>
            </section>

            {/* Contact Information */}
            <section className="border-t pt-8 mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Contact Information</h2>
              <p className="mb-4">
                For questions about these Terms of Service, please contact us at:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><strong>Email:</strong> legal@josetherealtor.com</p>
                <p><strong>Address:</strong> [Your Business Address]</p>
                <p><strong>Phone:</strong> [Your Business Phone]</p>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
