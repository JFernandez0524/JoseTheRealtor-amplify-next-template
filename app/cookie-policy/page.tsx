import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy | JoseTheRealtor',
  description: 'Cookie Policy for JoseTheRealtor lead management platform',
};

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Cookie Policy</h1>
          <p className="text-sm text-gray-500 mb-6">Last Updated: March 19, 2026</p>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-lg text-gray-700 mb-6">
              This Cookie Policy explains how JoseTheRealtor uses cookies and similar technologies 
              to enhance your experience on our platform.
            </p>
          </div>
        </div>

        {/* Cookie Policy Content */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="prose prose-gray max-w-none space-y-8">
            
            {/* Section 1: What Are Cookies */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. What Are Cookies</h2>
              <p className="mb-4">
                Cookies are small text files stored on your device when you visit our website. They help us 
                provide you with a better experience by remembering your preferences and analyzing how you use our services.
              </p>
            </section>

            {/* Section 2: Types of Cookies */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Types of Cookies We Use</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">2.1 Essential Cookies</h3>
              <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                <p className="font-semibold text-green-800 mb-2">Required for Platform Functionality</p>
                <ul className="list-disc pl-6 text-green-700 space-y-1">
                  <li><strong>Authentication:</strong> Keep you logged in securely</li>
                  <li><strong>Session Management:</strong> Maintain your session state</li>
                  <li><strong>Security:</strong> Protect against CSRF attacks</li>
                  <li><strong>Load Balancing:</strong> Distribute traffic efficiently</li>
                </ul>
                <p className="text-sm text-green-600 mt-2">
                  These cookies cannot be disabled as they are essential for the platform to function.
                </p>
              </div>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">2.2 Analytics Cookies</h3>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                <p className="font-semibold text-blue-800 mb-2">Google Analytics & Tag Manager</p>
                <ul className="list-disc pl-6 text-blue-700 space-y-1">
                  <li><strong>_ga:</strong> Distinguishes unique users (2 years)</li>
                  <li><strong>_ga_*:</strong> Stores session state (2 years)</li>
                  <li><strong>_gid:</strong> Distinguishes users (24 hours)</li>
                  <li><strong>_gtm:</strong> Google Tag Manager functionality</li>
                </ul>
                <p className="text-sm text-blue-600 mt-2">
                  These help us understand how you use our platform to improve our services.
                </p>
              </div>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">2.3 Preference Cookies</h3>
              <div className="bg-purple-50 border-l-4 border-purple-400 p-4 mb-4">
                <p className="font-semibold text-purple-800 mb-2">Remember Your Choices</p>
                <ul className="list-disc pl-6 text-purple-700 space-y-1">
                  <li><strong>Theme Preferences:</strong> Dark/light mode settings</li>
                  <li><strong>Language:</strong> Your preferred language</li>
                  <li><strong>Dashboard Layout:</strong> Customized view preferences</li>
                  <li><strong>Filter Settings:</strong> Saved search and filter preferences</li>
                </ul>
              </div>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">2.4 Marketing Cookies</h3>
              <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-4">
                <p className="font-semibold text-orange-800 mb-2">Campaign Tracking & Personalization</p>
                <ul className="list-disc pl-6 text-orange-700 space-y-1">
                  <li><strong>Campaign Attribution:</strong> Track marketing campaign effectiveness</li>
                  <li><strong>Conversion Tracking:</strong> Measure signup and subscription conversions</li>
                  <li><strong>Retargeting:</strong> Show relevant ads on other websites</li>
                  <li><strong>A/B Testing:</strong> Test different features and layouts</li>
                </ul>
                <p className="text-sm text-orange-600 mt-2">
                  You can opt-out of marketing cookies without affecting platform functionality.
                </p>
              </div>
            </section>

            {/* Section 3: Third-Party Cookies */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Third-Party Cookies</h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 mb-4">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Privacy Policy</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Google Analytics</td>
                      <td className="px-6 py-4 text-sm text-gray-500">Usage analytics and insights</td>
                      <td className="px-6 py-4 text-sm text-blue-600">
                        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-blue-800">
                          Google Privacy Policy
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Google Tag Manager</td>
                      <td className="px-6 py-4 text-sm text-gray-500">Tag and script management</td>
                      <td className="px-6 py-4 text-sm text-blue-600">
                        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-blue-800">
                          Google Privacy Policy
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">AWS Amplify</td>
                      <td className="px-6 py-4 text-sm text-gray-500">Authentication and hosting</td>
                      <td className="px-6 py-4 text-sm text-blue-600">
                        <a href="https://aws.amazon.com/privacy/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-800">
                          AWS Privacy Notice
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Stripe</td>
                      <td className="px-6 py-4 text-sm text-gray-500">Payment processing</td>
                      <td className="px-6 py-4 text-sm text-blue-600">
                        <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-blue-800">
                          Stripe Privacy Policy
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 4: Managing Cookies */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Managing Your Cookie Preferences</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">4.1 Browser Settings</h3>
              <p className="mb-4">
                You can control cookies through your browser settings. Here's how to manage cookies in popular browsers:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-2">Chrome</h4>
                  <p className="text-sm text-gray-600">Settings → Privacy and Security → Cookies and other site data</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-2">Firefox</h4>
                  <p className="text-sm text-gray-600">Options → Privacy & Security → Cookies and Site Data</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-2">Safari</h4>
                  <p className="text-sm text-gray-600">Preferences → Privacy → Manage Website Data</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-2">Edge</h4>
                  <p className="text-sm text-gray-600">Settings → Cookies and site permissions → Cookies and site data</p>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">4.2 Opt-Out Options</h3>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <p className="font-semibold text-yellow-800 mb-2">Analytics Opt-Out</p>
                <ul className="list-disc pl-6 text-yellow-700 space-y-1">
                  <li>
                    <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                      Google Analytics Opt-out Browser Add-on
                    </a>
                  </li>
                  <li>Enable "Do Not Track" in your browser settings</li>
                  <li>Use privacy-focused browsers or extensions</li>
                </ul>
              </div>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">4.3 Impact of Disabling Cookies</h3>
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                <p className="font-semibold text-red-800 mb-2">Important Notice</p>
                <p className="text-red-700">
                  Disabling essential cookies will prevent you from using our platform. Disabling other cookies 
                  may limit functionality such as remembering your preferences or providing personalized experiences.
                </p>
              </div>
            </section>

            {/* Section 5: Cookie Consent */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Cookie Consent</h2>
              
              <h3 className="text-lg font-semibold text-gray-800 mb-3">5.1 EU Cookie Law Compliance</h3>
              <p className="mb-4">
                For users in the European Union, we obtain your consent before using non-essential cookies. 
                You can withdraw consent at any time through your browser settings or by contacting us.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">5.2 Consent Management</h3>
              <p className="mb-4">
                We use a consent management system to record your cookie preferences. Your choices are stored 
                locally and respected across all your sessions.
              </p>
            </section>

            {/* Section 6: Updates */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Policy Updates</h2>
              <p className="mb-4">
                We may update this Cookie Policy to reflect changes in our practices or applicable laws. 
                We will notify you of material changes through our platform or via email.
              </p>
            </section>

            {/* Contact Information */}
            <section className="border-t pt-8 mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Contact Information</h2>
              <div className="bg-gray-50 p-6 rounded-lg">
                <p className="mb-4">
                  For questions about our use of cookies:
                </p>
                <div className="space-y-2">
                  <p><strong>Email:</strong> privacy@josetherealtor.com</p>
                  <p><strong>Privacy Policy:</strong> <a href="/privacy-policy" className="text-blue-600 hover:text-blue-800">View Privacy Policy</a></p>
                  <p><strong>Compliance Portal:</strong> <a href="/compliance" className="text-blue-600 hover:text-blue-800">Manage Your Data</a></p>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
