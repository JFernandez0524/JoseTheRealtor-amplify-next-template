import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { skipTraceLeads } from '../functions/skiptraceLeads/resource';
import { manualGhlSync } from '../functions/manualGhlSync/resource';
import { fixFailedSyncs } from '../functions/fixFailedSyncs/resource';
import { populateQueueFromGhl } from '../functions/populateQueueFromGhl/resource';

const schema = a.schema({
  CsvUploadJob: a
    .model({
      userId: a.string().required(),
      fileName: a.string().required(),
      leadType: a.string().required(),
      status: a.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
      totalRows: a.integer().default(0),
      processedRows: a.integer().default(0),
      successCount: a.integer().default(0),
      duplicateCount: a.integer().default(0),
      errorCount: a.integer().default(0),
      errorMessage: a.string(),
      startedAt: a.datetime(),
      completedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.owner().to(['create', 'read', 'update', 'delete']),
      allow.groups(['ADMINS']).to(['create', 'read', 'update', 'delete']),
    ]),

  OutreachQueue: a
    .model({
      userId: a.string().required(),
      locationId: a.string().required(),
      contactId: a.string().required(),
      contactName: a.string(),
      contactPhone: a.string(),
      contactEmail: a.string(),
      
      // Queue lifecycle status
      queueStatus: a.enum(['OUTREACH', 'CONVERSATION', 'DND', 'WRONG_INFO', 'COMPLETED']),
      
      // Outreach channel status
      smsStatus: a.enum(['PENDING', 'SENT', 'REPLIED', 'FAILED', 'OPTED_OUT']),
      emailStatus: a.enum(['PENDING', 'SENT', 'REPLIED', 'BOUNCED', 'FAILED', 'OPTED_OUT']),
      
      // Tracking timestamps
      smsAttempts: a.integer().default(0),
      emailAttempts: a.integer().default(0),
      lastSmsSent: a.datetime(),
      lastEmailSent: a.datetime(),
      nextSmsDate: a.datetime(), // Scheduled date for next SMS (SMS disabled)
      nextEmailDate: a.datetime(), // Scheduled date for next email
      lastContactDate: a.datetime(), // Last time WE contacted them (any channel)
      lastLeadReplyDate: a.datetime(), // Last time THEY replied to us
      
      // Property data for messaging
      propertyAddress: a.string(),
      propertyCity: a.string(),
      propertyState: a.string(),
      leadType: a.string(),
    })
    .authorization((allow) => [
      allow.owner().to(['create', 'read', 'update', 'delete']),
      allow.groups(['ADMINS']).to(['create', 'read', 'update', 'delete']),
    ])
    .secondaryIndexes((index) => [
      index('userId').sortKeys(['smsStatus']).queryField('byUserAndSmsStatus'),
      index('userId').sortKeys(['emailStatus']).queryField('byUserAndEmailStatus'),
      index('userId').sortKeys(['queueStatus']).queryField('byUserAndQueueStatus'),
    ]),

  GhlIntegration: a
    .model({
      userId: a.string().required(),
      locationId: a.string().required(),
      accessToken: a.string().required(),
      refreshToken: a.string(),
      tokenType: a.string().default('Bearer'),
      expiresAt: a.datetime().required(),
      scope: a.string(),
      isActive: a.boolean().default(true),
      // 📞 CAMPAIGN SETTINGS
      selectedPhoneNumber: a.string(), // User's selected phone for campaigns (deprecated - use campaignPhone)
      selectedEmail: a.string(), // User's selected email for campaigns (deprecated - use campaignEmail)
      campaignPhone: a.string(), // Hardcoded phone number for campaigns
      campaignEmail: a.string(), // Hardcoded email address for campaigns
      emailSignature: a.string(), // User's GHL email signature (HTML)
      // 📧 EMAIL TEMPLATES
      probateEmailSubject: a.string(), // Custom subject for probate leads
      probateEmailTemplate: a.string(), // Custom email template for probate leads
      preforeclosureEmailSubject: a.string(), // Custom subject for preforeclosure leads
      preforeclosureEmailTemplate: a.string(), // Custom email template for preforeclosure leads
      // 🚦 RATE LIMITING FIELDS
      dailyMessageCount: a.integer().default(0),
      hourlyMessageCount: a.integer().default(0),
      lastMessageSent: a.datetime(),
      lastHourReset: a.datetime(),
      lastDayReset: a.datetime(),
    })
    .authorization((allow) => [
      allow.owner().to(['create', 'read', 'update', 'delete']),
      allow.groups(['ADMINS']).to(['create', 'read', 'update', 'delete']),
    ]),

  DoorKnockQueue: a
    .model({
      userId: a.string().required(),
      leadId: a.id().required(),
      lead: a.belongsTo('PropertyLead', 'leadId'), // Relationship to get fresh data
      
      // Snapshot of lead data (for offline/quick access)
      ownerFirstName: a.string(),
      ownerLastName: a.string(),
      adminFirstName: a.string(), // For probate leads
      adminLastName: a.string(), // For probate leads
      propertyAddress: a.string(),
      propertyCity: a.string(),
      propertyState: a.string(),
      propertyZip: a.string(),
      leadType: a.string(),
      estimatedValue: a.float(),
      latitude: a.float(),
      longitude: a.float(),
      
      // Door knock status
      status: a.enum(['PENDING', 'VISITED', 'NOT_HOME', 'COMPLETED']),
      visitedAt: a.datetime(),
      notes: a.string(),
      
      // Priority override (optional - defaults to lead's AI priority)
      priority: a.enum(['HIGH', 'MEDIUM', 'LOW']),
    })
    .authorization((allow) => [
      allow.owner().to(['create', 'read', 'update', 'delete']),
      allow.groups(['ADMINS']).to(['create', 'read', 'update', 'delete']),
    ]),

  PropertyLead: a
    .model({
      // 🔒 Security: Make 'owner' read-only so it can't be reassigned
      owner: a.string().authorization((allow) => [allow.owner().to(['read'])]),

      // --- Basic Lead Info ---
      type: a.string().required(), // 'PREFORECLOSURE' or 'PROBATE'
      ownerFirstName: a.string(),
      ownerLastName: a.string(),
      ownerAddress: a.string().required(),
      ownerCity: a.string().required(),
      ownerState: a.string().required(),
      ownerZip: a.string().required(),
      ownerCounty: a.string(),

      // 💥 FIX 1: ADD NOTES FIELD for user-edited data (SOT: DynamoDB)
      notes: a.json().array(), // Array of {text: string, createdAt: string, createdBy: string}
      
      // Manual tags for custom workflows
      customTags: a.string().array(),

      // --- Admin/Executor Info (Probate) ---
      adminFirstName: a.string(),
      adminLastName: a.string(),
      adminAddress: a.string(),
      adminCity: a.string(),
      adminState: a.string(),
      adminZip: a.string(),
      adminStandardizedAddress: a.json(), // Google Validation Object for admin address

      // --- 🟢 Mailing Address (For Direct Mail) ---
      mailingAddress: a.string(),
      mailingCity: a.string(),
      mailingState: a.string(),
      mailingZip: a.string(),
      isAbsenteeOwner: a.boolean(),
      leadLabels: a.string().array(), // --- 🟢 Lead Labels (For Dashboard) ---

      // --- System Fields ---
      standardizedAddress: a.json(), // Google Validation Object

      // Statuses
      skipTraceStatus: a.enum(['PENDING', 'COMPLETED', 'FAILED', 'NO_MATCH', 'NO_QUALITY_CONTACTS']),
      skipTraceCompletedAt: a.datetime(),
      skipTraceHistory: a.json(), // Array of { timestamp, status, phonesFound, emailsFound }
      rawSkipTraceData: a.json(), // Store all skip trace results even if they don't pass filters
      validationStatus: a.enum(['VALID', 'INVALID']),
      validationErrors: a.string().array(), // Track validation issues for admin review
      listingStatus: a.enum(['off_market', 'active', 'sold', 'pending', 'fsbo', 'auction', 'skip', 'door_knock']), // Property listing status
      uploadSource: a.enum(['csv_upload', 'manual_entry', 'api_import']), // How the lead was added

      // 💥 NEW: GHL Sync Status Fields
      ghlSyncStatus: a.enum(['PENDING', 'SUCCESS', 'FAILED', 'SKIPPED']),
      ghlContactId: a.string(), // The Contact ID returned by GHL
      ghlSyncDate: a.datetime(), // ISO Date string of last sync attempt
      
      // 📤 GHL Outreach Data (synced from GHL custom fields)
      ghlOutreachData: a.json(), // { smsAttempts, emailAttempts, lastSmsSent, lastEmailSent, smsStatus, emailStatus, callOutcome, aiState }

      // Coordinates (For Map)
      latitude: a.float(),
      longitude: a.float(),

      // Contact Info (From Skip Trace V3)
      phones: a.string().array(),
      emails: a.string().array(),

      // --- 🟢 Financials (Market Intel) ---
      estimatedValue: a.float(),
      zestimate: a.float(),
      zestimateDate: a.datetime(),
      zestimateSource: a.string(), // 'ZILLOW', 'MANUAL', 'CSV'
      
      // Zillow API Response Data (to avoid re-fetching)
      zillowZpid: a.string(), // Zillow Property ID
      zillowUrl: a.string(), // Zillow property URL
      zillowAddress: a.string(), // Actual address from Zillow (for mismatch detection)
      rentZestimate: a.float(), // Rental estimate
      priceHistory: a.json(), // Array of price history
      taxHistory: a.json(), // Array of tax history
      homeDetails: a.json(), // Bedrooms, bathrooms, sqft, etc.
      neighborhoodData: a.json(), // Neighborhood stats
      comparableProperties: a.json(), // Recent comps
      zillowLastUpdated: a.datetime(), // When Zillow data was last fetched
      
      // 🤖 AI-Powered Fields
      aiScore: a.integer(), // 0-100 lead score
      aiPriority: a.enum(['HIGH', 'MEDIUM', 'LOW']), // AI-calculated priority
      aiInsights: a.string().array(), // AI-generated insights
      aiLastCalculated: a.datetime(), // When AI score was last calculated
      
      estimatedEquity: a.float(),
      mortgageBalance: a.float(),
      lastSaleDate: a.date(),
      lastSaleAmount: a.float(),
      
      // 🏦 BatchData Enrichment Fields (Preforeclosure only)
      equityPercent: a.float(), // Real equity % from BatchData
      ownerOccupied: a.boolean(), // Lives in property vs investor
      freeAndClear: a.boolean(), // No mortgage
      batchDataEnriched: a.boolean(), // Has been enriched
      batchDataEnrichedAt: a.datetime(), // When enriched

      // --- 🟢 Foreclosure Specifics ---
      foreclosureStatus: a.string(), // e.g. "Pre-Foreclosure"
      foreclosureRecordingDate: a.date(),
      foreclosureAuctionDate: a.date(), // Critical for sorting
      foreclosureAmount: a.float(),
      foreclosureTrustee: a.string(),

      createdAt: a.datetime(),
      updatedAt: a.datetime(),

      // --- Relationships ---
      contacts: a.hasMany('Contact', 'leadId'),
      enrichments: a.hasMany('Enrichment', 'leadId'),
      activities: a.hasMany('Activity', 'leadId'),
      doorKnockQueue: a.hasMany('DoorKnockQueue', 'leadId'),
    })
    .authorization((allow) => [allow.owner(), allow.group('ADMINS')])
    .secondaryIndexes((index) => [
      index('owner')
        .sortKeys(['ownerAddress'])
        .queryField('propertyLeadsByOwnerAndOwnerAddress'),
      index('owner').sortKeys(['createdAt']).queryField('leadsByDate'),
      index('owner').sortKeys(['skipTraceStatus']).queryField('leadsByStatus'),
      index('owner').sortKeys(['type']).queryField('leadsByType'),
      index('owner')
        .sortKeys(['validationStatus'])
        .queryField('leadsByValidationStatus'),
      index('owner').sortKeys(['estimatedEquity']).queryField('leadsByEquity'),
      index('owner')
        .sortKeys(['foreclosureAuctionDate'])
        .queryField('leadsByAuctionDate'),
    ]),

  Contact: a
    .model({
      owner: a.string().authorization((allow) => [allow.owner().to(['read'])]),
      leadId: a.id(),
      lead: a.belongsTo('PropertyLead', 'leadId'),
      firstName: a.string(),
      lastName: a.string(),
      middleName: a.string(),
      phones: a.json().array(),
      emails: a.json().array(),
      addresses: a.json().array(),
      litigator: a.boolean(),
      deceased: a.boolean(),
      createdAt: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),

  Enrichment: a
    .model({
      owner: a.string().authorization((allow) => [allow.owner().to(['read'])]),
      leadId: a.id(),
      lead: a.belongsTo('PropertyLead', 'leadId'),
      source: a.string(),
      statusText: a.string(),
      payload: a.json(),
      createdAt: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),

  Activity: a
    .model({
      owner: a.string().authorization((allow) => [allow.owner().to(['read'])]),
      leadId: a.id(),
      lead: a.belongsTo('PropertyLead', 'leadId'),
      type: a.string(),
      channel: a.string(),
      outcome: a.string(),
      meta: a.json(),
      createdAt: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),

  chat: a
    .conversation({
      aiModel: a.ai.model('Claude 3.5 Sonnet'),
      systemPrompt: 'You are a helpful real estate assistant.',
      inferenceConfiguration: { temperature: 0.2, topP: 0.2, maxTokens: 200 },
    })
    .authorization((allow) => allow.owner()),

  skipTraceLeads: a
    .mutation()
    .arguments({
      leadIds: a.string().array().required(),
    })
    .returns(a.json())
    .handler(a.handler.function(skipTraceLeads))
    .authorization((allow) => [allow.groups(['FREE', 'PRO', 'ADMINS'])]),

  manualGhlSync: a
    .mutation()
    .arguments({
      leadId: a.id().required(),
    })
    .returns(a.json())
    .handler(a.handler.function(manualGhlSync))
    .authorization((allow) => [allow.groups(['PRO', 'ADMINS'])]),

  fixFailedSyncs: a
    .query()
    .returns(a.json())
    .handler(a.handler.function(fixFailedSyncs))
    .authorization((allow) => [allow.group('ADMINS')]),

  populateQueueFromGhl: a
    .query()
    .returns(a.json())
    .handler(a.handler.function(populateQueueFromGhl))
    .authorization((allow) => [allow.group('ADMINS')]),

  Notification: a
    .model({
      title: a.string(),
      message: a.string(),
      type: a.enum(['INFO', 'SUCCESS', 'WARNING', 'ERROR']),
      isRead: a.boolean().default(false),
    })
    .authorization((allow) => [allow.owner()]),

  addUserToGroup: a
    .mutation()
    .arguments({
      userId: a.string().required(),
      groupName: a.string().required(),
    })
    // 🚧 DEV MODE: Temporarily allow any authenticated user to promote themselves
    .authorization((allow) => [allow.group('ADMINS')])
    .handler(a.handler.function('addUserToGroup'))
    .returns(a.json()),

  removeUserFromGroup: a
    .mutation()
    .arguments({
      userId: a.string().required(),
      groupName: a.string().required(),
    })
    .authorization((allow) => [allow.group('ADMINS')])
    .handler(a.handler.function('removeUserFromGroup'))
    .returns(a.json()),

  UserAccount: a
    .model({
      owner: a.string().authorization((allow) => [allow.owner().to(['read'])]),
      email: a.string().required(),
      credits: a.integer().default(0),
      creditsExpiresAt: a.datetime(),
      registrationIP: a.string(),
      lastLoginIP: a.string(),
      
      // GHL Integration Type
      ghlIntegrationType: a.enum(['OAUTH', 'SUB_ACCOUNT', 'NONE']),
      ghlSubAccountId: a.string(), // For managed sub-accounts
      ghlSubAccountStatus: a.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED']),
      
      // GHL Rate Limiting
      hourlyMessageCount: a.integer().default(0),
      dailyMessageCount: a.integer().default(0),
      lastHourReset: a.integer(), // Timestamp in milliseconds
      lastDayReset: a.integer(), // Timestamp in milliseconds
      
      crmLocationId: a.string(),
      crmApiKey: a.string(),
      totalLeadsSynced: a.integer().default(0),
      totalSkipsPerformed: a.integer().default(0),
    })
    .authorization((allow) => [allow.owner(), allow.group('ADMINS')]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});
