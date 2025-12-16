import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { skipTraceLeads } from '../functions/skiptraceLeads/resource';
import { manualGhlSync } from '../functions/manualGhlSync/resource';

const schema = a.schema({
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

      // --- 🟢 Building & Tax Data (From BatchData V1) ---
      bedrooms: a.integer(),
      bathrooms: a.float(), // e.g. 2.5
      squareFeet: a.integer(),
      lotSize: a.integer(),
      yearBuilt: a.integer(),
      propertyType: a.string(), // e.g. "Single Family"
      taxAssessment: a.float(),
      taxYear: a.integer(),

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
      foreclosureAmount: a.float(), // Default Amount
      foreclosureTrustee: a.string(),

      createdAt: a.datetime(),
      updatedAt: a.datetime(),

      // --- Relationships ---
      contacts: a.hasMany('Contact', 'leadId'),
      enrichments: a.hasMany('Enrichment', 'leadId'),
      activities: a.hasMany('Activity', 'leadId'),
    })
    .authorization((allow) => [allow.owner()])
    .secondaryIndexes((index) => [
      // 1. Duplicate Check
      index('owner')
        .sortKeys(['ownerAddress'])
        .queryField('propertyLeadsByOwnerAndOwnerAddress'),

      // 2. Dashboard Sorting (Date)
      index('owner').sortKeys(['createdAt']).queryField('leadsByDate'),

      // 3. Dashboard Filtering (Status)
      index('owner').sortKeys(['skipTraceStatus']).queryField('leadsByStatus'),

      // 4. Dashboard Filtering (Type)
      index('owner').sortKeys(['type']).queryField('leadsByType'),

      // 5. Dashboard Filtering (Validation)
      index('owner')
        .sortKeys(['validationStatus'])
        .queryField('leadsByValidationStatus'),

      // 6. 🟢 Sort by Equity (High -> Low)
      index('owner').sortKeys(['estimatedEquity']).queryField('leadsByEquity'),

      // 7. 🟢 Sort by Auction Date (Urgency)
      index('owner')
        .sortKeys(['foreclosureAuctionDate'])
        .queryField('leadsByAuctionDate'),
    ]),

  // --- Sub Models ---

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

  // --- AI Chat ---
  chat: a
    .conversation({
      aiModel: a.ai.model('Claude 3.5 Sonnet'),
      systemPrompt: 'You are a helpful real estate assistant.',
      inferenceConfiguration: { temperature: 0.2, topP: 0.2, maxTokens: 200 },
    })
    .authorization((allow) => allow.owner()),

  // --- Custom Mutation ---
  skipTraceLeads: a
    .mutation()
    .arguments({
      leadIds: a.string().array().required(),
      // 💥 UPDATED: Removed targetCrm since GHL is the standard
    })
    .returns(a.json())
    .handler(a.handler.function(skipTraceLeads))
    .authorization((allow) => [allow.authenticated()]),

  // 💥 2. NEW: Manual GHL Sync (On-Demand)
  syncLeadToGHL: a
    .mutation()
    .arguments({
      leadId: a.id().required(), // Takes a single lead ID
    })
    .returns(a.json()) // Returns a status object for the UI
    .handler(a.handler.function(manualGhlSync)) // Link to the new Lambda function
    .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});
