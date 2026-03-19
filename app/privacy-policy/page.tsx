import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | JoseTheRealtor',
  description: 'Privacy Policy for JoseTheRealtor lead management platform',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-6">Last Updated: March 19, 2026</p>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-lg text-gray-700 mb-6">
              This Privacy Policy describes how JoseTheRealtor collects, uses, and protects your personal information 
              when you use our lead management platform and services.
            </p>
          </div>
        </div>

        {/* Privacy Policy Content */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="prose prose-gray max-w-none space-y-8">
            
            {/* Section 1: Information We Collect */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Information We Collect</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">1.1 Account Information</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Name, email address, phone number</li>
                <li>Company information and business details</li>
                <li>Payment and billing information</li>
                <li>Account preferences and settings</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">1.2 Lead Data</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Property owner names and contact information</li>
                <li>Property addresses and details</li>
                <li>Skip trace results and contact data</li>
                <li>Property valuation and market data</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">1.3 Usage Information</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Platform usage patterns and feature interactions</li>
                <li>AI conversation logs and messaging history</li>
                <li>Search queries and filter preferences</li>
                <li>Integration usage (GoHighLevel, Thanks.io)</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">1.4 Technical Information</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>IP address, browser type, device information</li>
                <li>Cookies and tracking technologies</li>
                <li>Log files and error reports</li>
                <li>Performance and analytics data</li>
              </ul>
            </section>

            {/* Section 2: How We Use Information */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. How We Use Your Information</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">2.1 Service Provision</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Provide lead management and skip tracing services</li>
                <li>Process payments and manage subscriptions</li>
                <li>Enable AI messaging and automation features</li>
                <li>Facilitate third-party integrations</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">2.2 Communication</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Send service updates and notifications</li>
                <li>Provide customer support</li>
                <li>Send marketing communications (with consent)</li>
                <li>Respond to inquiries and requests</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">2.3 Improvement and Analytics</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Analyze usage patterns to improve services</li>
                <li>Develop new features and functionality</li>
                <li>Ensure platform security and prevent fraud</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            {/* Section 3: Information Sharing */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. How We Share Your Information</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">3.1 Third-Party Service Providers</h3>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                <p className="font-semibold text-blue-800 mb-2">Data Processing Partners:</p>
                <ul className="list-disc pl-6 text-blue-700 space-y-1">
                  <li><strong>BatchData:</strong> Property data enrichment and skip tracing services</li>
                  <li><strong>GoHighLevel:</strong> CRM integration and contact management</li>
                  <li><strong>Thanks.io:</strong> Direct mail campaign services</li>
                  <li><strong>OpenAI:</strong> AI messaging and conversation processing</li>
                  <li><strong>AWS:</strong> Cloud hosting and data storage</li>
                  <li><strong>Stripe:</strong> Payment processing</li>
                </ul>
              </div>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">3.2 Legal Requirements</h3>
              <p className="mb-4">
                We may disclose information when required by law, court order, or to protect our rights, 
                property, or safety, or that of our users or others.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">3.3 Business Transfers</h3>
              <p className="mb-4">
                In the event of a merger, acquisition, or sale of assets, your information may be 
                transferred as part of the business transaction.
              </p>
            </section>

            {/* Section 4: Data Security */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Data Security</h2>
              <p className="mb-4">
                We implement appropriate technical and organizational measures to protect your personal information:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Encryption of data in transit and at rest</li>
                <li>Access controls and authentication systems</li>
                <li>Regular security audits and monitoring</li>
                <li>Employee training on data protection</li>
                <li>Incident response and breach notification procedures</li>
              </ul>
            </section>

            {/* Section 5: Your Rights */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Your Privacy Rights</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">5.1 CCPA Rights (California Residents)</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li><strong>Right to Know:</strong> Request information about data collection and use</li>
                <li><strong>Right to Delete:</strong> Request deletion of personal information</li>
                <li><strong>Right to Opt-Out:</strong> Opt-out of sale of personal information</li>
                <li><strong>Right to Non-Discrimination:</strong> Equal service regardless of privacy choices</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">5.2 GDPR Rights (EU Residents)</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li><strong>Access:</strong> Obtain a copy of your personal data</li>
                <li><strong>Rectification:</strong> Correct inaccurate personal data</li>
                <li><strong>Erasure:</strong> Request deletion of personal data</li>
                <li><strong>Portability:</strong> Receive data in a structured format</li>
                <li><strong>Objection:</strong> Object to processing for direct marketing</li>
                <li><strong>Restriction:</strong> Limit processing of personal data</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">5.3 Exercising Your Rights</h3>
              <p className="mb-4">
                To exercise your privacy rights, contact us at <strong>privacy@josetherealtor.com</strong> 
                or use our <a href="/compliance" className="text-blue-600 hover:text-blue-800">compliance portal</a>.
              </p>
            </section>

            {/* Section 6: Cookies and Tracking */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Cookies and Tracking</h2>
              <p className="mb-4">
                We use cookies and similar technologies to enhance your experience. For detailed information, 
                see our <a href="/cookie-policy" className="text-blue-600 hover:text-blue-800">Cookie Policy</a>.
              </p>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">6.1 Types of Cookies</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li><strong>Essential:</strong> Required for platform functionality</li>
                <li><strong>Analytics:</strong> Google Analytics for usage insights</li>
                <li><strong>Preferences:</strong> Remember your settings and choices</li>
                <li><strong>Marketing:</strong> Track campaign effectiveness</li>
              </ul>
            </section>

            {/* Section 7: Data Retention */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Data Retention</h2>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li><strong>Account Data:</strong> Retained while account is active plus 7 years</li>
                <li><strong>Lead Data:</strong> Retained per user preferences, minimum 1 year</li>
                <li><strong>Usage Logs:</strong> Retained for 2 years for security and analytics</li>
                <li><strong>Marketing Data:</strong> Retained until consent is withdrawn</li>
              </ul>
            </section>

            {/* Section 8: International Transfers */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. International Data Transfers</h2>
              <p className="mb-4">
                Your information may be transferred to and processed in countries other than your own. 
                We ensure appropriate safeguards are in place for international transfers, including 
                standard contractual clauses and adequacy decisions.
              </p>
            </section>

            {/* Section 9: Children's Privacy */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Children's Privacy</h2>
              <p className="mb-4">
                Our services are not intended for individuals under 18 years of age. We do not knowingly 
                collect personal information from children under 18.
              </p>
            </section>

            {/* Section 10: Updates */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Policy Updates</h2>
              <p className="mb-4">
                We may update this Privacy Policy periodically. Material changes will be communicated 
                via email or platform notification. Continued use constitutes acceptance of updates.
              </p>
            </section>

            {/* Contact Information */}
            <section className="border-t pt-8 mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Contact Information</h2>
              <div className="bg-gray-50 p-6 rounded-lg">
                <p className="mb-4">
                  For privacy-related questions, requests, or concerns:
                </p>
                <div className="space-y-2">
                  <p><strong>Privacy Officer:</strong> privacy@josetherealtor.com</p>
                  <p><strong>General Contact:</strong> support@josetherealtor.com</p>
                  <p><strong>Mailing Address:</strong> [Your Business Address]</p>
                  <p><strong>Phone:</strong> [Your Business Phone]</p>
                </div>
                <p className="mt-4 text-sm text-gray-600">
                  We will respond to privacy requests within 30 days (45 days for complex requests).
                </p>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
