// amplify/data/resource.ts
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

// Core models
const schema = a.schema({
  Lead: a
    .model({
      type: a.string().required(), // "probate" | "preforeclosure"
      address: a.string().required(),
      firstName: a.string(),
      lastName: a.string(),
      city: a.string().required(),
      state: a.string().required(),
      zip: a.string().required(),
      standardizedAddress: a.json(), // full BatchData standardized address result

      // probate-specific
      executorFirstName: a.string(),
      executorLastName: a.string(),
      mailingAddress: a.string(),
      mailingCity: a.string(),
      mailingState: a.string(),
      mailingZip: a.string(),

      // preforeclosure-specific
      borrowerFirstName: a.string(),
      borrowerLastName: a.string(),
      caseNumber: a.string(),

      // relationships
      contacts: a.hasMany('Contact', 'leadId'),
      enrichments: a.hasMany('Enrichment', 'leadId'),
      activities: a.hasMany('Activity', 'leadId'),

      createdAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.owner(), // 👈 Each user only sees their own leads
      allow.groups(['ADMINS']), // Admins can see everyone’s leads
    ]),

  Contact: a
    .model({
      leadId: a.id(), // belongs-to FK
      lead: a.belongsTo('Lead', 'leadId'),
      role: a.string(), // "executor" | "owner" | "other"
      firstName: a.string(),
      lastName: a.string(),
      emails: a.json(), // string[]
      phones: a.json(), // {number, type, tested, reachable, score}[]
      mailingAddress: a.json().required(), // {street, city, state, zip, county}
      createdAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.owner(), // 👈 Each user only sees their own leads
      allow.groups(['ADMINS']), // Admins can see everyone’s leads
    ]),

  Enrichment: a
    .model({
      leadId: a.id(),
      lead: a.belongsTo('Lead', 'leadId'),
      source: a.string(), // "batchdata:address-verify" | "batchdata:lookup" | "batchdata:skiptrace"
      statusText: a.string(),
      payload: a.json(), // full raw response or normalized fragment
      createdAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.owner(), // 👈 Each user only sees their own leads
      allow.groups(['ADMINS']), // Admins can see everyone’s leads
    ]),

  Activity: a
    .model({
      leadId: a.id(),
      lead: a.belongsTo('Lead', 'leadId'),
      type: a.string(), // "call" | "email" | "letter" | "sms" | "note"
      channel: a.string(),
      outcome: a.string(),
      meta: a.json(), // e.g., agent, templateId, recordingUrl
      createdAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.owner(), // 👈 Each user only sees their own leads
      allow.groups(['ADMINS']), // Admins can see everyone’s leads
    ]),

  //Conversation Route AI setup
  chat: a
    .conversation({
      aiModel: a.ai.model('Claude 3.5 Haiku'),
      systemPrompt: 'You are a helpful assistant',
    })
    .authorization((allow) => allow.owner()),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'iam',
  },
});
