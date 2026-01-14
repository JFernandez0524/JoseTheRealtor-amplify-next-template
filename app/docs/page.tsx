import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'User Guide | JoseTheRealtor',
  description: 'Complete guide to using the JoseTheRealtor lead management platform',
};

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">User Guide</h1>
          
          {/* Table of Contents */}
          <div className="bg-blue-50 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold text-blue-900 mb-4">Quick Navigation</h2>
            <div className="grid md:grid-cols-2 gap-2 text-sm">
              <a href="#getting-started" className="text-blue-600 hover:underline">• Getting Started</a>
              <a href="#lead-import" className="text-blue-600 hover:underline">• Lead Import Process</a>
              <a href="#dashboard" className="text-blue-600 hover:underline">• Dashboard Features</a>
              <a href="#skip-tracing" className="text-blue-600 hover:underline">• Skip Tracing</a>
              <a href="#ghl-integration" className="text-blue-600 hover:underline">• GoHighLevel Integration</a>
              <a href="#pricing" className="text-blue-600 hover:underline">• Pricing & Plans</a>
              <a href="#troubleshooting" className="text-blue-600 hover:underline">• Troubleshooting</a>
            </div>
          </div>

          {/* Getting Started */}
          <section id="getting-started" className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">🚀 Getting Started</h2>
            
            <div className="space-y-6">
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Account Setup</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Sign up with Google OAuth (recommended) or email</li>
                  <li>Start with FREE plan (5 starter credits included)</li>
                  <li>Upgrade to SYNC PLAN ($97/month) or AI OUTREACH PLAN ($250/month) as needed</li>
                </ol>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">✨ What Happens Automatically</h4>
                <ul className="list-disc list-inside space-y-1 text-yellow-700 text-sm">
                  <li>Address validation using Google Maps API</li>
                  <li>Automatic Zestimate fetching from Zillow</li>
                  <li>County detection from address validation</li>
                  <li>Lead deduplication to prevent duplicates</li>
                  <li>Property coordinates for mapping</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Lead Import */}
          <section id="lead-import" className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">📊 Lead Import Process</h2>
            
            <div className="space-y-6">
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">CSV Format Requirements</h3>
                <p className="text-gray-700 mb-3">Your CSV should include these columns:</p>
                <div className="bg-gray-100 p-4 rounded-lg font-mono text-sm">
                  <div className="grid md:grid-cols-2 gap-2">
                    <div>
                      <strong>Required:</strong><br/>
                      • ownerFirstName<br/>
                      • ownerLastName<br/>
                      • ownerAddress<br/>
                      • ownerCity<br/>
                      • ownerState<br/>
                      • ownerZip<br/>
                      • type (PREFORECLOSURE or PROBATE)
                    </div>
                    <div>
                      <strong>Optional:</strong><br/>
                      • estimatedValue<br/>
                      • foreclosureAuctionDate<br/>
                      • adminFirstName (for probate)<br/>
                      • adminLastName (for probate)<br/>
                      • adminAddress (for probate)<br/>
                      • phone (if pre-skip traced)
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">🔄 Automatic Processing</h4>
                <ol className="list-decimal list-inside space-y-1 text-green-700 text-sm">
                  <li>Address validation with Google Maps</li>
                  <li>County detection and geocoding</li>
                  <li>Zestimate fetching from Zillow API</li>
                  <li>Duplicate detection and prevention</li>
                  <li>Lead categorization and labeling</li>
                </ol>
              </div>
            </div>
          </section>

          {/* Dashboard */}
          <section id="dashboard" className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">📋 Dashboard Features</h2>
            
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="border border-gray-200 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">🔍 Search & Filtering</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Search by name, address, phone, email, tags</li>
                    <li>• Filter by lead type (Probate/Preforeclosure)</li>
                    <li>• Filter by manual status (ACTIVE, SOLD, PENDING, etc.)</li>
                    <li>• Filter by skip trace status</li>
                    <li>• Filter by GHL sync status</li>
                    <li>• Filter by phone availability</li>
                    <li>• Date range filtering for skip traced leads</li>
                  </ul>
                </div>
                
                <div className="border border-gray-200 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">📊 Sorting Options</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Sort by Created Date (newest first)</li>
                    <li>• Sort by Owner Name (alphabetical)</li>
                    <li>• Sort by County (alphabetical)</li>
                    <li>• Sort by Zestimate (highest first)</li>
                    <li>• Sort by Skip Trace Date</li>
                    <li>• Click column headers to sort</li>
                    <li>• Click again to reverse order</li>
                  </ul>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-medium text-purple-800 mb-2">🏷️ Manual Status Management</h4>
                <p className="text-sm text-purple-700 mb-2">Track your lead pipeline with status labels:</p>
                <ul className="list-disc list-inside space-y-1 text-purple-700 text-sm">
                  <li><strong>ACTIVE</strong> - Currently pursuing this lead</li>
                  <li><strong>SOLD</strong> - Deal closed (auto-excluded from skip tracing)</li>
                  <li><strong>PENDING</strong> - Under contract or in negotiation</li>
                  <li><strong>OFF_MARKET</strong> - Property not currently available</li>
                  <li><strong>SKIP</strong> - Not interested (auto-excluded from skip tracing)</li>
                </ul>
                <p className="text-sm text-purple-600 mt-2">💡 Use "Set Status..." dropdown for bulk updates</p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">💰 Property Valuations</h4>
                <ul className="list-disc list-inside space-y-1 text-green-700 text-sm">
                  <li>Click Zestimate amount to view property on Zillow</li>
                  <li>Age indicator shows days since last update (e.g., "45d old")</li>
                  <li>⚠️ Red warning appears for data older than 180 days</li>
                  <li>Click refresh button (↻) to fetch current property value</li>
                  <li>Automatic rate limiting prevents API failures</li>
                </ul>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-medium text-purple-800 mb-2">🤖 AI Lead Scoring</h4>
                <ul className="list-disc list-inside space-y-1 text-purple-700 text-sm">
                  <li>Select leads and click "🤖 Calculate AI Scores"</li>
                  <li>AI analyzes: equity, value, timeline, location, contact availability</li>
                  <li>Scores 0-100 with priority: HIGH (70+), MEDIUM (40-69), LOW (&lt;40)</li>
                  <li>Filter by AI Priority to focus on hottest leads</li>
                  <li>View AI Insights Dashboard for top leads and urgent items</li>
                  <li>Sort by AI Score column to prioritize outreach</li>
                </ul>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg">
                <h4 className="font-medium text-orange-800 mb-2">🏦 Property Enrichment (Preforeclosure Only)</h4>
                <ul className="list-disc list-inside space-y-1 text-orange-700 text-sm">
                  <li>Select preforeclosure leads and click "🏦 Enrich Leads"</li>
                  <li>Cost: $0.29 per lead (includes contact info + property data)</li>
                  <li>Get real equity %, mortgage balances, property value</li>
                  <li>Quality phone numbers: Mobile only, score 90+, not DNC</li>
                  <li>Owner emails and property flags (owner occupied, high equity)</li>
                  <li>Filter enriched leads by owner occupied and high equity</li>
                  <li>View enrichment data in lead details page</li>
                  <li>Note: Probate leads use regular skip trace ($0.10/lead)</li>
                </ul>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">⚡ Bulk Operations</h4>
                <p className="text-sm text-blue-700 mb-2">Manage multiple leads efficiently:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700 text-sm">
                  <li><strong>Set Status</strong> - Update status for all selected leads at once</li>
                  <li><strong>Skip Trace</strong> - Find contact info with cost preview ($0.10/lead)</li>
                  <li><strong>Sync to GHL</strong> - Push to CRM (rate limited: 100/hour, 1000/day)</li>
                  <li><strong>Export CSV</strong> - Download with all data including manual status</li>
                  <li><strong>Delete</strong> - Remove selected leads (admin only)</li>
                </ul>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">💡 Navigation Tips</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-700 text-sm">
                  <li><strong>Double-click</strong> table rows to view lead details</li>
                  <li>Use checkboxes for bulk operations (skip trace, sync, delete)</li>
                  <li>100 leads per page with pagination controls</li>
                  <li>Horizontal scroll for all table columns</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Skip Tracing */}
          <section id="skip-tracing" className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">🔍 Skip Tracing</h2>
            
            <div className="space-y-6">
              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">How It Works</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Select leads from dashboard (use checkboxes)</li>
                  <li>View cost preview (e.g., "50 Selected - Cost: $5.00")</li>
                  <li>Click "Skip Trace" button</li>
                  <li>System finds phone numbers and emails</li>
                  <li>Results appear in Phone and Email columns</li>
                  <li>Status updates to "COMPLETED"</li>
                </ol>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">💰 Cost Savings</h4>
                <p className="text-sm text-yellow-700 mb-2">Leads marked as SOLD or SKIP are automatically excluded from skip tracing to prevent wasted credits.</p>
                <ul className="list-disc list-inside space-y-1 text-yellow-700 text-sm">
                  <li>Cost preview shows before you commit</li>
                  <li>Only charged for successful skip traces</li>
                  <li>Duplicate prevention within your account</li>
                  <li>Each user maintains independent lead lists</li>
                </ul>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">💰 Pricing</h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• $0.10 per successful skip trace</li>
                    <li>• FREE users: 5 starter credits</li>
                    <li>• Credit packages: $10, $25, $50</li>
                    <li>• Credits expire after 30 days</li>
                  </ul>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-medium text-orange-800 mb-2">📥 Download Options</h4>
                  <ul className="text-sm text-orange-700 space-y-1">
                    <li>• Filter by skip trace completion date</li>
                    <li>• Click "Download Skip Traced" button</li>
                    <li>• CSV includes all contact information</li>
                    <li>• Includes manual status and completion dates</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* GHL Integration */}
          <section id="ghl-integration" className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">🔗 GoHighLevel Integration</h2>
            
            <div className="space-y-6">
              <div className="border-l-4 border-indigo-500 pl-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Setup Process</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Go to Profile section in dashboard</li>
                  <li>Click "Connect GHL" button</li>
                  <li>Authorize with your GoHighLevel account</li>
                  <li>Select your location/sub-account</li>
                  <li>Connection persists across login sessions</li>
                </ol>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">🚦 Rate Limiting Protection</h4>
                <p className="text-sm text-green-700 mb-2">System enforces API limits to prevent service interruptions:</p>
                <ul className="list-disc list-inside space-y-1 text-green-700 text-sm">
                  <li><strong>100 syncs per hour</strong> - Prevents hourly rate limit blocks</li>
                  <li><strong>1,000 syncs per day</strong> - Prevents daily rate limit blocks</li>
                  <li>Automatic counter reset after time window expires</li>
                  <li>Error message if limit reached with retry guidance</li>
                </ul>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-medium text-purple-800 mb-2">🔄 Automatic Sync Features</h4>
                <ul className="list-disc list-inside space-y-1 text-purple-700 text-sm">
                  <li>Syncs lead contact information and property details</li>
                  <li>Includes Zestimate data (full market value for listing)</li>
                  <li>Includes Cash Offer (70% of Zestimate for as-is purchase)</li>
                  <li>Maps to your GHL custom fields automatically</li>
                  <li>Tags leads for direct mail or phone campaigns</li>
                  <li>Updates lead status to track sync progress</li>
                  <li>Bulk sync multiple leads at once</li>
                </ul>
              </div>

              <div className="bg-indigo-50 p-4 rounded-lg">
                <h4 className="font-medium text-indigo-800 mb-2">📬 Direct Mail Automation</h4>
                <ul className="list-disc list-inside space-y-1 text-indigo-700 text-sm">
                  <li>Zestimate and Cash Offer automatically sent to GHL</li>
                  <li>Leads tagged as "Direct-Mail-Only" or "Direct_Mail_Eligible"</li>
                  <li>GHL automation triggers Click2Mail webhook</li>
                  <li>Mail merge inserts property values into letter template</li>
                  <li>Letters show both listing and cash purchase options</li>
                  <li>No manual letter generation needed - fully automated</li>
                </ul>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">🏷️ Custom Tags</h4>
                <p className="text-yellow-700 text-sm mb-2">Add custom tags to leads for workflow automation:</p>
                <ul className="list-disc list-inside space-y-1 text-yellow-700 text-sm">
                  <li>Go to lead details page (double-click from dashboard)</li>
                  <li>Use Tags Manager to add/remove tags</li>
                  <li>Tags are searchable from dashboard</li>
                  <li>Use for custom GHL workflow triggers</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section id="pricing" className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">💳 Pricing & Plans</h2>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="border border-gray-200 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">FREE</h3>
                <p className="text-2xl font-bold text-gray-900 mb-4">$0/month</p>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>• 5 starter skip credits</li>
                  <li>• Lead import & management</li>
                  <li>• Basic dashboard features</li>
                  <li>• Purchase additional credits</li>
                </ul>
              </div>
              
              <div className="border border-blue-500 p-6 rounded-lg bg-blue-50">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">SYNC PLAN</h3>
                <p className="text-2xl font-bold text-blue-900 mb-4">$97/month</p>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• Everything in FREE</li>
                  <li>• GoHighLevel integration</li>
                  <li>• Bulk lead sync</li>
                  <li>• Custom tags & workflows</li>
                  <li>• Priority support</li>
                </ul>
              </div>
              
              <div className="border border-purple-500 p-6 rounded-lg bg-purple-50">
                <h3 className="text-lg font-semibold text-purple-900 mb-2">AI OUTREACH PLAN</h3>
                <p className="text-2xl font-bold text-purple-900 mb-4">$250/month</p>
                <ul className="text-sm text-purple-700 space-y-2">
                  <li>• Everything in SYNC</li>
                  <li>• AI text agent for outreach</li>
                  <li>• Automated follow-ups</li>
                  <li>• Advanced analytics</li>
                  <li>• White-glove support</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Skip Credit Packages (All Plans)</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <strong>100 Credits</strong><br/>
                  $10 ($0.10 each)
                </div>
                <div className="text-center">
                  <strong>250 Credits</strong><br/>
                  $25 ($0.10 each)
                </div>
                <div className="text-center">
                  <strong>500 Credits</strong><br/>
                  $50 ($0.10 each)
                </div>
              </div>
            </div>
          </section>

          {/* Troubleshooting */}
          <section id="troubleshooting" className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">🔧 Troubleshooting</h2>
            
            <div className="space-y-6">
              <div className="border border-red-200 p-4 rounded-lg">
                <h3 className="font-medium text-red-800 mb-2">Common Issues</h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <strong className="text-red-700">CSV Upload Fails:</strong>
                    <p className="text-red-600">Ensure required columns are present and properly formatted. Check for special characters in addresses. Large uploads are automatically rate-limited to prevent API failures.</p>
                  </div>
                  <div>
                    <strong className="text-red-700">Skip Trace No Results:</strong>
                    <p className="text-red-600">Verify address data is complete and accurate. Some properties may not have available contact information.</p>
                  </div>
                  <div>
                    <strong className="text-red-700">GHL Sync Errors:</strong>
                    <p className="text-red-600">Check OAuth connection in Profile settings. Reconnect if the connection shows as expired. Rate limits: 100/hour, 1000/day.</p>
                  </div>
                  <div>
                    <strong className="text-red-700">Stale Zestimate Data:</strong>
                    <p className="text-red-600">Click the refresh button (↻) next to any Zestimate showing a red warning (&gt;180 days old) to fetch current values.</p>
                  </div>
                  <div>
                    <strong className="text-red-700">Missing Credits:</strong>
                    <p className="text-red-600">Credits expire after 30 days. Purchase new credit packages or upgrade to a paid plan.</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">💡 Best Practices</h4>
                <ul className="list-disc list-inside space-y-1 text-green-700 text-sm">
                  <li>Clean your CSV data before uploading for better results</li>
                  <li>Use manual status labels to organize and track your pipeline</li>
                  <li>Mark leads as SOLD or SKIP to prevent wasted skip trace credits</li>
                  <li>Use bulk status updates to manage large lead lists efficiently</li>
                  <li>Refresh stale Zestimates (&gt;180 days) before making offers</li>
                  <li>Filter by skip trace completion date for targeted downloads</li>
                  <li>Connect GHL early to streamline your workflow</li>
                  <li>Use double-click to navigate to avoid accidental clicks</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Support */}
          <div className="bg-blue-50 p-6 rounded-lg text-center">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Need More Help?</h3>
            <p className="text-blue-700 mb-4">Our support team is here to help you succeed with your lead management.</p>
            <div className="space-y-2">
              <p className="text-sm text-blue-600">📧 Email: support@josetherealtor.com</p>
              <p className="text-sm text-blue-600">💬 Live Chat: Available in dashboard</p>
              <p className="text-sm text-blue-600">📞 Priority Support: Available for paid plans</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
