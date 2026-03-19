import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TCPA Compliance | JoseTheRealtor',
  description: 'TCPA Compliance Notice for JoseTheRealtor automated messaging services',
};

export default function TCPACompliance() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">TCPA Compliance Notice</h1>
          <p className="text-sm text-gray-500 mb-6">Last Updated: March 19, 2026</p>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-lg text-gray-700 mb-6">
              This notice explains how JoseTheRealtor complies with the Telephone Consumer Protection Act (TCPA) 
              for our automated messaging and calling services.
            </p>
          </div>
        </div>

        {/* TCPA Compliance Content */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="prose prose-gray max-w-none space-y-8">
            
            {/* Section 1: TCPA Overview */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. TCPA Overview</h2>
              <p className="mb-4">
                The Telephone Consumer Protection Act (TCPA) is a federal law that restricts automated calls, 
                text messages, and fax communications to protect consumers from unwanted solicitations.
              </p>
              
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                <p className="font-semibold text-red-800 mb-2">Important Legal Notice</p>
                <p className="text-red-700">
                  TCPA violations can result in penalties of $500-$1,500 per message. You are solely responsible 
                  for ensuring compliance with all TCPA requirements when using our services.
                </p>
              </div>
            </section>

            {/* Section 2: Our Automated Services */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Our Automated Messaging Services</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">2.1 AI Outreach Services</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li><strong>SMS Messages:</strong> Automated text messages to property leads</li>
                <li><strong>Email Communications:</strong> Automated email outreach campaigns</li>
                <li><strong>Multi-Channel Messaging:</strong> Facebook, Instagram, WhatsApp integration</li>
                <li><strong>Follow-up Sequences:</strong> Automated response and nurture campaigns</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">2.2 Business Hours Compliance</h3>
              <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                <p className="font-semibold text-green-800 mb-2">Automatic Time Restrictions</p>
                <ul className="list-disc pl-6 text-green-700 space-y-1">
                  <li><strong>Monday-Friday:</strong> 9:00 AM - 7:00 PM EST</li>
                  <li><strong>Saturday:</strong> 9:00 AM - 12:00 PM EST</li>
                  <li><strong>Sunday:</strong> No automated messages sent</li>
                  <li><strong>Holidays:</strong> Automatic suspension on federal holidays</li>
                </ul>
              </div>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">2.3 Rate Limiting</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>2-second delays between individual messages</li>
                <li>Maximum 7 touches per contact over 28 days</li>
                <li>Automatic throttling during high-volume periods</li>
                <li>Respect for carrier-level rate limits</li>
              </ul>
            </section>

            {/* Section 3: Consent Requirements */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Consent Requirements</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">3.1 Your Responsibilities</h3>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <p className="font-semibold text-yellow-800 mb-2">Critical Compliance Requirement</p>
                <p className="text-yellow-700 mb-2">
                  You must obtain proper consent before using our services to contact any individual. This includes:
                </p>
                <ul className="list-disc pl-6 text-yellow-700 space-y-1">
                  <li><strong>Express Written Consent:</strong> For automated calls to cell phones</li>
                  <li><strong>Prior Business Relationship:</strong> For existing customers or inquiries</li>
                  <li><strong>Opt-in Consent:</strong> For marketing and promotional messages</li>
                  <li><strong>Clear Disclosure:</strong> Nature and frequency of communications</li>
                </ul>
              </div>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">3.2 Consent Documentation</h3>
              <p className="mb-4">You must maintain records of consent including:</p>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Date and method of consent obtained</li>
                <li>Specific language used to obtain consent</li>
                <li>Identity of person providing consent</li>
                <li>Phone number(s) consented to receive messages</li>
                <li>Scope of consent (types of messages, frequency)</li>
              </ul>
            </section>

            {/* Section 4: Opt-Out Procedures */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Opt-Out Procedures</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">4.1 Automatic Opt-Out Recognition</h3>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                <p className="font-semibold text-blue-800 mb-2">AI-Powered Opt-Out Detection</p>
                <p className="text-blue-700 mb-2">Our AI automatically recognizes and processes these opt-out requests:</p>
                <ul className="list-disc pl-6 text-blue-700 space-y-1">
                  <li>"STOP", "UNSUBSCRIBE", "REMOVE"</li>
                  <li>"Don't contact me", "Take me off your list"</li>
                  <li>"Not interested", "Stop calling/texting"</li>
                  <li>Any clear indication of withdrawal of consent</li>
                </ul>
              </div>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">4.2 Opt-Out Processing</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li><strong>Immediate Processing:</strong> Opt-outs processed within 10 seconds</li>
                <li><strong>Confirmation Message:</strong> Automatic confirmation sent to requester</li>
                <li><strong>System-Wide Block:</strong> Number blocked across all campaigns</li>
                <li><strong>Manual Override:</strong> You can manually add numbers to opt-out list</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">4.3 Alternative Opt-Out Methods</h3>
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="font-semibold text-gray-800 mb-2">Additional Ways to Opt-Out:</p>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li><strong>Email:</strong> optout@josetherealtor.com</li>
                  <li><strong>Phone:</strong> [Your Business Phone]</li>
                  <li><strong>Online Form:</strong> <a href="/compliance" className="text-blue-600 hover:text-blue-800">Compliance Portal</a></li>
                  <li><strong>Mail:</strong> [Your Business Address]</li>
                </ul>
              </div>
            </section>

            {/* Section 5: Do Not Call Registry */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Do Not Call Registry Compliance</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">5.1 DNC Scrubbing</h3>
              <p className="mb-4">
                You are responsible for scrubbing your contact lists against the National Do Not Call Registry 
                before using our services for marketing calls or texts.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">5.2 Established Business Relationship Exception</h3>
              <p className="mb-4">
                You may contact individuals with whom you have an established business relationship, even if 
                they are on the DNC Registry, provided:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>The relationship was established within the last 18 months</li>
                <li>The contact is related to the business relationship</li>
                <li>You provide clear opt-out mechanisms</li>
              </ul>
            </section>

            {/* Section 6: Record Keeping */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Record Keeping Requirements</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">6.1 Your Record Keeping Obligations</h3>
              <p className="mb-4">You must maintain records for at least 4 years including:</p>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Consent records and documentation</li>
                <li>Opt-out requests and processing dates</li>
                <li>DNC Registry scrubbing records</li>
                <li>Call/message logs and timestamps</li>
                <li>Training records for staff handling communications</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">6.2 Our Record Keeping</h3>
              <p className="mb-4">We maintain records of:</p>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Message delivery attempts and results</li>
                <li>Opt-out requests and processing</li>
                <li>System-generated compliance logs</li>
                <li>Business hours enforcement logs</li>
              </ul>
            </section>

            {/* Section 7: Penalties and Enforcement */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Penalties and Enforcement</h2>
              
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                <p className="font-semibold text-red-800 mb-2">TCPA Violation Penalties</p>
                <ul className="list-disc pl-6 text-red-700 space-y-1">
                  <li><strong>Per Message:</strong> $500-$1,500 per violation</li>
                  <li><strong>Willful Violations:</strong> Up to $1,500 per message</li>
                  <li><strong>Class Action Risk:</strong> Potential for large-scale lawsuits</li>
                  <li><strong>FCC Enforcement:</strong> Additional regulatory penalties</li>
                </ul>
              </div>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">7.1 Your Liability</h3>
              <p className="mb-4">
                You are solely responsible for TCPA compliance when using our services. We provide tools 
                to help with compliance, but cannot guarantee your compliance with all applicable laws.
              </p>
            </section>

            {/* Section 8: Best Practices */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. TCPA Best Practices</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">8.1 Recommended Practices</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Always obtain clear, documented consent before messaging</li>
                <li>Regularly scrub lists against DNC Registry</li>
                <li>Provide clear identification in all messages</li>
                <li>Include opt-out instructions in every message</li>
                <li>Monitor and respond to opt-out requests promptly</li>
                <li>Train staff on TCPA compliance requirements</li>
                <li>Maintain detailed records of all communications</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">8.2 Legal Consultation</h3>
              <p className="mb-4">
                We strongly recommend consulting with a qualified attorney familiar with TCPA regulations 
                to ensure your specific use case complies with all applicable laws.
              </p>
            </section>

            {/* Contact Information */}
            <section className="border-t pt-8 mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">TCPA Compliance Contact</h2>
              <div className="bg-gray-50 p-6 rounded-lg">
                <p className="mb-4">
                  For TCPA compliance questions or to report violations:
                </p>
                <div className="space-y-2">
                  <p><strong>Compliance Officer:</strong> compliance@josetherealtor.com</p>
                  <p><strong>Opt-Out Requests:</strong> optout@josetherealtor.com</p>
                  <p><strong>Phone:</strong> [Your Business Phone]</p>
                  <p><strong>Compliance Portal:</strong> <a href="/compliance" className="text-blue-600 hover:text-blue-800">Manage Communications</a></p>
                </div>
                <p className="mt-4 text-sm text-gray-600">
                  Opt-out requests will be processed within 10 seconds during business hours, 
                  or by the next business day for requests received outside business hours.
                </p>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
