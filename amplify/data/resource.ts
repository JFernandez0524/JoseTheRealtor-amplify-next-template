import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { skipTraceLeads } from '../functions/skiptraceLeads/resource';

const schema = a.schema({
  PropertyLead: a
    .model({
      owner: a.string().authorization((allow) => [allow.owner().to(['read'])]),
      type: a.string().required(),
      ownerFirstName: a.string(),
      ownerLastName: a.string(),
      ownerAddress: a.string().required(),
      ownerCity: a.string().required(),
      ownerState: a.string().required(),
      ownerZip: a.string().required(),
      adminFirstName: a.string(),
      adminLastName: a.string(),
      adminAddress: a.string(),
      adminCity: a.string(),
      adminState: a.string(),
      adminZip: a.string(),
      standardizedAddress: a.json(),
      skipTraceStatus: a.enum(['PENDING', 'COMPLETED', 'FAILED', 'NO_MATCH']),
      latitude: a.float(),
      longitude: a.float(),
      phones: a.string().array(),
      emails: a.string().array(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      // 🟢 NEW: Track if the address is good or bad
      validationStatus: a.enum(['VALID', 'INVALID']),
      // Relations
      contacts: a.hasMany('Contact', 'leadId'),
      enrichments: a.hasMany('Enrichment', 'leadId'),
      activities: a.hasMany('Activity', 'leadId'),
    })
    .authorization((allow) => [allow.owner()])
    // 👇 NEW INDEX: Allows fast lookup by Owner + Address
    .secondaryIndexes((index) => [
      // 1. Existing Index (Duplicate Check)
      index('owner')
        .sortKeys(['ownerAddress'])
        .queryField('propertyLeadsByOwnerAndOwnerAddress'),

      // 2. 🟢 NEW: Sort by Date (Recent First)
      index('owner').sortKeys(['createdAt']).queryField('leadsByDate'),

      // 3. 🟢 NEW: Filter by Status (Quickly find PENDING)
      index('owner').sortKeys(['skipTraceStatus']).queryField('leadsByStatus'),

      // 4. 🟢 NEW: Filter by Type (e.g. Probate vs Preforeclosure)
      index('owner').sortKeys(['type']).queryField('leadsByType'),
      index('owner')
        .sortKeys(['validationStatus'])
        .queryField('leadsByValidationStatus'),
    ]),

  Contact: a
    .model({
      owner: a.string().authorization((allow) => [allow.owner().to(['read'])]),
      leadId: a.id(),
      lead: a.belongsTo('PropertyLead', 'leadId'),

      // Person Details
      firstName: a.string(),
      lastName: a.string(),
      middleName: a.string(), // Added

      // Store full objects from API to keep metadata (rank, type, carrier)
      phones: a.json().array(),
      emails: a.json().array(),

      // Changed from single required address to optional array of addresses
      addresses: a.json().array(),

      // Flags
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
      targetCrm: a.enum(['GHL', 'KVCORE', 'NONE']),
    })
    .returns(a.json())
    .handler(a.handler.function(skipTraceLeads))
    .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});
