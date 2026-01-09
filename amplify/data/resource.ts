import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { skipTraceLeads } from '../functions/skiptraceLeads/resource';
import { manualGhlSync } from '../functions/manualGhlSync/resource';

const schema = a.schema({
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

      // 💥 FIX 1: ADD NOTES FIELD for user-edited data (SOT: DynamoDB)
      notes: a.json().array(), // Array of {text: string, createdAt: string, createdBy: string}

      // --- Admin/Executor Info (Probate) ---
      adminFirstName: a.string(),
      adminLastName: a.string(),
      adminAddress: a.string(),
      adminCity: a.string(),
      adminState: a.string(),
      adminZip: a.string(),

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
      skipTraceStatus: a.enum(['PENDING', 'COMPLETED', 'FAILED', 'NO_MATCH']),
      validationStatus: a.enum(['VALID', 'INVALID']),

      // 💥 NEW: GHL Sync Status Fields
      ghlSyncStatus: a.enum(['PENDING', 'SUCCESS', 'FAILED', 'SKIPPED']),
      ghlContactId: a.string(), // The Contact ID returned by GHL
      ghlSyncDate: a.datetime(), // ISO Date string of last sync attempt

      // Coordinates (For Map)
      latitude: a.float(),
      longitude: a.float(),

      // Contact Info (From Skip Trace V3)
      phones: a.string().array(),
      emails: a.string().array(),

      // --- 🟢 Financials (Market Intel) ---
      estimatedValue: a.float(),
      estimatedEquity: a.float(),
      mortgageBalance: a.float(),
      lastSaleDate: a.date(),
      lastSaleAmount: a.float(),

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
