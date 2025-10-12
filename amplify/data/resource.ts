// import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any user authenticated via an API key can "create", "read",
"update", and "delete" any "Todo" records.
=========================================================================*/
// const schema = a.schema({
//   Todo: a
//     .model({
//       content: a.string(),
//     })
//     .authorization((allow) => [allow.publicApiKey()]),
// });

// export type Schema = ClientSchema<typeof schema>;

// export const data = defineData({
//   schema,
//   authorizationModes: {
//     defaultAuthorizationMode: "apiKey",
//     apiKeyAuthorizationMode: {
//       expiresInDays: 30,
//     },
//   },
// });

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>

// amplify/data/resource.ts

import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

// Core models
const schema = a.schema({
  Lead: a
    .model({
      type: a.string().required(), // "probate" | "preforeclosure"
      address: a.string().required(),
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
    .authorization((allow) => [allow.publicApiKey()]),

  Enrichment: a
    .model({
      leadId: a.id(),
      lead: a.belongsTo('Lead', 'leadId'),
      source: a.string(), // "batchdata:address-verify" | "batchdata:lookup" | "batchdata:skiptrace"
      statusText: a.string(),
      payload: a.json(), // full raw response or normalized fragment
      createdAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

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
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'iam',
  },
});
