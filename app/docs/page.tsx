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
              <a href="#ghl-tags" className="text-blue-600 hover:underline">• GHL Tags Reference</a>
              <a href="#direct-mail" className="text-blue-600 hover:underline">• Direct Mail (Thanks.io)</a>
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

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">📈 Upload Progress Tracking</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-700 text-sm">
                  <li>After clicking "Start CSV Import", a progress modal appears automatically</li>
                  <li>Shows real-time row count: processed / total with a progress bar</li>
                  <li>Displays success, duplicate, and error counts as rows are processed</li>
                  <li>Duplicate leads are listed with links to existing records</li>
                  <li>Download a duplicate report before the modal closes</li>
                  <li>Automatically redirects to dashboard when complete</li>
                </ul>
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
                  <li>Click refresh button (↻) to fetch current property value from Zillow</li>
                  <li><strong>✏️ Manual Override</strong>: Click the ✏️ pencil icon to type in a value manually when Zillow can't find the property — saves directly to the lead and shows a "✏️ manual" badge</li>
                </ul>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">🗂️ Listing Status Column</h4>
                <p className="text-sm text-yellow-700 mb-2">Track the MLS/market status of each property directly in the table. Change via dropdown — no need to open lead details:</p>
                <ul className="list-disc list-inside space-y-1 text-yellow-700 text-sm">
                  <li><strong>Off Market</strong> — not listed anywhere</li>
                  <li><strong>Active</strong> — currently listed on MLS</li>
                  <li><strong>Sold</strong> — recently sold</li>
                  <li><strong>Pending</strong> — under contract</li>
                  <li><strong>FSBO</strong> — For Sale By Owner</li>
                  <li><strong>Auction</strong> — going to auction</li>
                  <li><strong>Skip</strong> — skip this property</li>
                  <li><strong>Door Knock</strong> — flagged for in-person visit</li>
                </ul>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-medium text-purple-800 mb-2">🤖 AI Lead Scoring</h4>
                <ul className="list-disc list-inside space-y-1 text-purple-700 text-sm">
                  <li>Select leads and click "🤖 Calculate AI Scores"</li>
                  <li>AI analyzes: equity, value, timeline, location, contact availability</li>
                  <li>Scores 0-100 with priority: HIGH (70+), MEDIUM (40-69), LOW (&lt;40)</li>
                  <li>Filter by AI Priority to focus on hottest leads</li>
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
                  <li><strong>Automatic initial email</strong> sent to all email addresses on sync</li>
                </ul>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">📧 Email Campaign System</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-700 text-sm">
                  <li><strong>Initial Email</strong>: Automatically sent when contact is created in GHL</li>
                  <li><strong>Business Hours</strong>: Mon–Fri 9AM–7PM EST, Sat 9AM–12PM EST, Sunday closed</li>
                  <li>Emails sent to ALL addresses (primary + email_2 + email_3)</li>
                  <li>Personalized with property data (address, Zestimate, cash offer)</li>
                  <li>Reply detection: Automatically tags replied contacts and stops automation</li>
                  <li>Bounce protection: Stops emails to bounced addresses</li>
                  <li>Configure email address in Profile → GHL Settings</li>
                  <li>Rate limited: 2 seconds between emails to prevent throttling</li>
                </ul>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">📱 AI Multi-Channel Outreach (SMS, Facebook, Instagram, WhatsApp)</h4>
                <ul className="list-disc list-inside space-y-1 text-green-700 text-sm">
                  <li><strong>Channels</strong>: SMS, Facebook Messenger, Instagram DMs, WhatsApp — same AI handles all four</li>
                  <li><strong>Business Hours</strong>: Mon–Fri 9AM–7PM EST, Sat 9AM–12PM EST, Sunday closed</li>
                  <li>AI uses a proven 5-step script to qualify leads and schedule property visits</li>
                  <li>Adapts message based on lead type (preforeclosure vs probate)</li>
                  <li>Instant webhook responses to inbound replies (no polling delay)</li>
                  <li>Tags contact for human handoff when qualified</li>
                  <li>Configure phone number in Profile → GHL Settings</li>
                  <li>Rate limited: 2 seconds between messages</li>
                </ul>
              </div>

              <div className="bg-amber-50 p-4 rounded-lg">
                <h4 className="font-medium text-amber-800 mb-2">⚙️ GHL Settings Configuration</h4>
                <ul className="list-disc list-inside space-y-1 text-amber-700 text-sm">
                  <li>Go to Profile → GHL Settings card</li>
                  <li><strong>Campaign Phone</strong>: Select which GHL phone number for SMS</li>
                  <li><strong>Campaign Email</strong>: Set your verified email address</li>
                  <li>All messages sent from your selected phone/email</li>
                  <li>Replies route directly to you</li>
                  <li>Settings are per-user (multi-tenant support)</li>
                </ul>
              </div>

              <div className="bg-indigo-50 p-4 rounded-lg">
                <h4 className="font-medium text-indigo-800 mb-2">📬 Outreach Queue & 7-Touch Cadence</h4>
                <p className="text-sm text-indigo-700 mb-2">Each contact with the <code className="bg-indigo-100 px-1 rounded">ai outreach</code> tag gets up to <strong>7 touches per channel</strong> over 28 days:</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-indigo-700 mb-3 font-mono">
                  <div>Touch 1: Day 1</div><div>Touch 2: Day 5</div>
                  <div>Touch 3: Day 9</div><div>Touch 4: Day 13</div>
                  <div>Touch 5: Day 17</div><div>Touch 6: Day 21</div>
                  <div>Touch 7: Day 25</div>
                </div>
                <ul className="list-disc list-inside space-y-1 text-indigo-700 text-sm">
                  <li>Contacts with multiple phones/emails get 7 touches <em>per channel</em> (e.g., 2 phones + 2 emails = up to 28 total touches)</li>
                  <li>Touches stop automatically when contact replies, bounces, or opts out</li>
                  <li>Queue is populated automatically when contact is synced to GHL with <code className="bg-indigo-100 px-1 rounded">ai outreach</code> tag</li>
                </ul>
              </div>

              <div className="bg-red-50 p-4 rounded-lg">
                <h4 className="font-medium text-red-800 mb-2">🛑 Stopping the AI / Taking Over Manually</h4>
                <p className="text-sm text-red-700 mb-2">To stop the AI from responding to a contact and take over the conversation yourself:</p>
                <ol className="list-decimal list-inside space-y-1 text-red-700 text-sm">
                  <li>Open the contact in GoHighLevel</li>
                  <li>Remove the <code className="bg-red-100 px-1 rounded">ai outreach</code> tag</li>
                  <li>The AI immediately stops all automated outreach and webhook responses for that contact</li>
                </ol>
                <p className="text-sm text-red-600 mt-2">💡 To resume AI outreach later, simply re-add the <code className="bg-red-100 px-1 rounded">ai outreach</code> tag</p>
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

          {/* GHL Tags Reference */}
          <section id="ghl-tags" className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">🏷️ GHL Tags Reference</h2>
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-3">System Tags (added automatically on sync)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-3 items-start"><code className="bg-gray-200 px-2 py-0.5 rounded text-xs whitespace-nowrap">app:synced</code><span className="text-gray-700">Contact was synced from the app to GHL</span></div>
                  <div className="flex gap-3 items-start"><code className="bg-green-100 px-2 py-0.5 rounded text-xs whitespace-nowrap">ai outreach</code><span className="text-gray-700">Contact is eligible for AI email + SMS outreach. <strong>Remove this tag to stop all AI automation.</strong></span></div>
                  <div className="flex gap-3 items-start"><code className="bg-blue-100 px-2 py-0.5 rounded text-xs whitespace-nowrap">direct mail only</code><span className="text-gray-700">No qualified contact info found — direct mail only, no AI outreach</span></div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-3">Outreach Status Tags (added automatically during conversations)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-3 items-start"><code className="bg-yellow-100 px-2 py-0.5 rounded text-xs whitespace-nowrap">conversation:active</code><span className="text-gray-700">Contact replied to an SMS/social message — AI is in active conversation</span></div>
                  <div className="flex gap-3 items-start"><code className="bg-yellow-100 px-2 py-0.5 rounded text-xs whitespace-nowrap">email:replied</code><span className="text-gray-700">Contact replied to an email</span></div>
                  <div className="flex gap-3 items-start"><code className="bg-red-100 px-2 py-0.5 rounded text-xs whitespace-nowrap">email:bounced</code><span className="text-gray-700">Email bounced — no further emails will be sent to this address</span></div>
                  <div className="flex gap-3 items-start"><code className="bg-gray-200 px-2 py-0.5 rounded text-xs whitespace-nowrap">conversation_ended</code><span className="text-gray-700">AI conversation completed — no further automated follow-ups</span></div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-3">Direct Mail Tags (added by Thanks.io webhook on delivery/scan)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-3 items-start"><code className="bg-indigo-100 px-2 py-0.5 rounded text-xs whitespace-nowrap">mail:delivered</code><span className="text-gray-700">Any mail piece was delivered</span></div>
                  <div className="flex gap-3 items-start"><code className="bg-indigo-100 px-2 py-0.5 rounded text-xs whitespace-nowrap">mail:touch1</code><span className="text-gray-700">First mail piece delivered → move to "Touch 1 - Delivered" pipeline stage</span></div>
                  <div className="flex gap-3 items-start"><code className="bg-indigo-100 px-2 py-0.5 rounded text-xs whitespace-nowrap">mail:touch2</code><span className="text-gray-700">Second mail piece delivered → move to "Touch 2 - Delivered" pipeline stage</span></div>
                  <div className="flex gap-3 items-start"><code className="bg-indigo-100 px-2 py-0.5 rounded text-xs whitespace-nowrap">mail:touch3</code><span className="text-gray-700">Third mail piece delivered → move to "Touch 3 - Delivered" pipeline stage</span></div>
                  <div className="flex gap-3 items-start"><code className="bg-orange-200 px-2 py-0.5 rounded text-xs whitespace-nowrap">mail:scanned</code><span className="text-gray-700">🔥 QR code scanned — HOT LEAD! Move to "Engaged" stage and call immediately</span></div>
                  <div className="flex gap-3 items-start"><code className="bg-orange-200 px-2 py-0.5 rounded text-xs whitespace-nowrap">high-engagement</code><span className="text-gray-700">Added alongside mail:scanned to flag high-engagement contacts</span></div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-3">Recommended GHL Workflow Automations</h4>
                <div className="space-y-1 text-sm text-blue-700 font-mono">
                  <div>Tag <code className="bg-blue-100 px-1 rounded">mail:touch1</code> added → Move to "Touch 1 - Delivered"</div>
                  <div>Tag <code className="bg-blue-100 px-1 rounded">mail:touch2</code> added → Move to "Touch 2 - Delivered"</div>
                  <div>Tag <code className="bg-blue-100 px-1 rounded">mail:touch3</code> added → Move to "Touch 3 - Delivered"</div>
                  <div>Tag <code className="bg-orange-100 px-1 rounded">mail:scanned</code> added → Move to "Engaged" + notify you</div>
                  <div>60 days in "Touch 3" without <code className="bg-blue-100 px-1 rounded">mail:scanned</code> → Move to "Dead"</div>
                </div>
              </div>
            </div>
          </section>

          {/* Direct Mail */}
          <section id="direct-mail" className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">📮 Direct Mail Automation (Thanks.io)</h2>
            <div className="space-y-6">
              <div className="border-l-4 border-indigo-500 pl-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Setup Requirements</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm">
                  <li>Skip trace probate leads in the app</li>
                  <li>Leads without qualified contact info get the <code className="bg-gray-100 px-1 rounded">direct mail only</code> tag automatically</li>
                  <li>Sync to GHL — contact enters "New Lead" pipeline stage</li>
                  <li>Export contacts with <code className="bg-gray-100 px-1 rounded">direct mail only</code> tag from GHL</li>
                  <li>Upload to Thanks.io — set <code className="bg-gray-100 px-1 rounded">custom_1</code> field = GHL contact ID (<code className="bg-gray-100 px-1 rounded">{`{{contact.contact_id}}`}</code>)</li>
                  <li>Configure webhook in Thanks.io dashboard: <strong>dashboard.thanks.io/profile/webhooks</strong></li>
                </ol>
              </div>

              <div className="bg-indigo-50 p-4 rounded-lg">
                <h4 className="font-medium text-indigo-800 mb-3">📅 Automated Mail Flow</h4>
                <div className="space-y-2 text-sm text-indigo-700">
                  <div className="flex gap-2"><span className="font-bold whitespace-nowrap">Day 0:</span><span>Mail #1 sent via Thanks.io</span></div>
                  <div className="flex gap-2"><span className="font-bold whitespace-nowrap">Day 3–5:</span><span>Mail #1 delivered → webhook fires → <code className="bg-indigo-100 px-1 rounded">mail:touch1</code> tag → move to "Touch 1 - Delivered"</span></div>
                  <div className="flex gap-2"><span className="font-bold whitespace-nowrap">Day 21:</span><span>Mail #2 sent via Thanks.io</span></div>
                  <div className="flex gap-2"><span className="font-bold whitespace-nowrap">Day 24–26:</span><span>Mail #2 delivered → webhook fires → <code className="bg-indigo-100 px-1 rounded">mail:touch2</code> tag → move to "Touch 2 - Delivered"</span></div>
                  <div className="flex gap-2"><span className="font-bold whitespace-nowrap">Day 42:</span><span>Mail #3 sent via Thanks.io</span></div>
                  <div className="flex gap-2"><span className="font-bold whitespace-nowrap">Day 45–47:</span><span>Mail #3 delivered → webhook fires → <code className="bg-indigo-100 px-1 rounded">mail:touch3</code> tag → move to "Touch 3 - Delivered"</span></div>
                  <div className="flex gap-2"><span className="font-bold whitespace-nowrap text-orange-700">Any time:</span><span className="text-orange-700">QR scan → webhook fires → <code className="bg-orange-100 px-1 rounded">mail:scanned</code> + <code className="bg-orange-100 px-1 rounded">high-engagement</code> → move to "Engaged" → <strong>Call immediately!</strong></span></div>
                  <div className="flex gap-2"><span className="font-bold whitespace-nowrap">Day 107:</span><span>60 days after Touch 3 with no engagement → move to "Dead"</span></div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-3">Pipeline Stages</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                  <li>New Lead</li>
                  <li>Touch 1 - Delivered</li>
                  <li>Touch 2 - Delivered</li>
                  <li>Touch 3 - Delivered</li>
                  <li className="text-orange-700 font-semibold">Engaged (Hot! — QR scanned)</li>
                  <li>Dead</li>
                </ol>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">✅ Key Points</h4>
                <ul className="list-disc list-inside space-y-1 text-green-700 text-sm">
                  <li>Thanks.io controls mail timing (21-day intervals between pieces)</li>
                  <li>Webhook tracks delivery and moves pipeline stages automatically</li>
                  <li>QR scan = instant hot lead notification — call immediately</li>
                  <li><code className="bg-green-100 px-1 rounded">mail_sent_count</code> only increments on actual delivery, not send</li>
                  <li>No engagement after 60 days past Touch 3 = Dead</li>
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
