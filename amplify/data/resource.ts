import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { testFunction } from '../functions/testFunction/resource';

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
      skipTraceStatus: a.enum(['PENDING', 'COMPLETED', 'FAILED']),
      latitude: a.float(),
      longitude: a.float(),
      phone: a.phone(),
      email: a.email(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),

      // Relations
      contacts: a.hasMany('Contact', 'leadId'),
      enrichments: a.hasMany('Enrichment', 'leadId'),
      activities: a.hasMany('Activity', 'leadId'),
    })
    .authorization((allow) => [allow.owner()])
    // 👇 NEW INDEX: Allows fast lookup by Owner + Address
    .secondaryIndexes((index) => [
      index('owner')
        .sortKeys(['ownerAddress'])
        .queryField('leadsByOwnerAddress'),
    ]),

  Contact: a
    .model({
      owner: a.string().authorization((allow) => [allow.owner().to(['read'])]),
      leadId: a.id(),
      lead: a.belongsTo('PropertyLead', 'leadId'),
      firstName: a.string(),
      lastName: a.string(),
      emails: a.json().array(),
      phones: a.json().array(),
      mailingAddress: a.json().required(),
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

  testFunction: a
    .query()
    .arguments({ message: a.string() })
    .returns(a.string())
    .handler(a.handler.function(testFunction))
    .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});
