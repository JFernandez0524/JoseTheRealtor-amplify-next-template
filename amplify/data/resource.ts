// amplify/data/resource.ts
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { testFunction } from '../functions/testFunction/resource';

// Core models
const schema = a.schema({
  Lead: a
    .model({
      // 👇 CRITICAL: Owner field with read-only authorization
      owner: a.string().authorization((allow) => [allow.owner().to(['read'])]),

      type: a.string().required(), // "probate" | "preforeclosure"
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
      standardizedAddress: a.json(), // From Google or BatchData

      skipTraceStatus: a.enum([
        'PENDING', // Not yet processed
        'COMPLETED', // Skip trace was successful
        'FAILED', // Skip trace failed
      ]),
      latitude: a.float(),
      longitude: a.float(),

      // --- Pre-Foreclosure Data ---
      preforeclosureNoticeDate: a.date(),
      preforeclosureAuctionDate: a.date(),

      // --- Assessment/Value Data ---
      estimatedValue: a.float(),
      estimatedValueYear: a.integer(),

      // --- Basic Building Data ---
      yearBuilt: a.integer(),
      squareFeet: a.integer(),
      bedrooms: a.integer(),
      baths: a.float(),

      // --- Relationships ---
      contacts: a.hasMany('Contact', 'leadId'),
      enrichments: a.hasMany('Enrichment', 'leadId'),
      activities: a.hasMany('Activity', 'leadId'),

      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.owner(), // Owner can read, create, update, delete their own leads
    ]),

  Contact: a
    .model({
      // 👇 Owner field with read-only authorization
      owner: a.string().authorization((allow) => [allow.owner().to(['read'])]),

      leadId: a.id(), // belongs-to FK
      lead: a.belongsTo('Lead', 'leadId'),
      role: a.string(), // "executor" | "owner" | "other"
      firstName: a.string(),
      lastName: a.string(),
      emails: a.json().array(), // string[]
      phones: a.json().array(), // {number, type, tested, reachable, score}[]
      mailingAddress: a.json().required(), // {street, city, state, zip, county}
      createdAt: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),

  Enrichment: a
    .model({
      // 👇 Owner field with read-only authorization
      owner: a.string().authorization((allow) => [allow.owner().to(['read'])]),

      leadId: a.id(), // belongs-to FK
      lead: a.belongsTo('Lead', 'leadId'),
      source: a.string(), // "batchdata:address-verify" | "batchdata:lookup" | "batchdata:skiptrace"
      statusText: a.string(),
      payload: a.json(), // full raw response or normalized fragment
      createdAt: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),

  Activity: a
    .model({
      // 👇 Owner field with read-only authorization
      owner: a.string().authorization((allow) => [allow.owner().to(['read'])]),

      leadId: a.id(), // belongs-to FK
      lead: a.belongsTo('Lead', 'leadId'),
      type: a.string(), // "call" | "email" | "letter" | "sms" | "note"
      channel: a.string(),
      outcome: a.string(),
      meta: a.json(), // e.g., agent, templateId, recordingUrl
      createdAt: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),

  // 🔹 Conversation route (chat-based AI)
  chat: a
    .conversation({
      aiModel: a.ai.model('Claude 3.5 Sonnet'),
      systemPrompt:
        'You are a helpful real estate assistant. ' +
        'Your answers must be concise, professional, and easy to read. ' +
        'Use bullet points (using * or -) and newlines to format your response. ' +
        'Keep answers to 3-4 sentences unless asked for more.',

      inferenceConfiguration: {
        temperature: 0.2,
        topP: 0.2,
        maxTokens: 200,
      },
    })
    .authorization((allow) => allow.owner()),

  //custom functions
  testFunction: a
    .query()
    .arguments({
      message: a.string(),
    })
    .returns(a.string())
    .handler(a.handler.function(testFunction))
    .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
