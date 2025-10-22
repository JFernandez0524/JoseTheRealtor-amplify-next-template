/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getActivity = /* GraphQL */ `
  query GetActivity($id: ID!) {
    getActivity(id: $id) {
      channel
      createdAt
      id
      lead {
        address
        borrowerFirstName
        borrowerLastName
        caseNumber
        city
        createdAt
        executorFirstName
        executorLastName
        id
        mailingAddress
        mailingCity
        mailingState
        mailingZip
        owner
        standardizedAddress
        state
        type
        updatedAt
        zip
        __typename
      }
      leadId
      meta
      outcome
      owner
      type
      updatedAt
      __typename
    }
  }
`;
export const getContact = /* GraphQL */ `
  query GetContact($id: ID!) {
    getContact(id: $id) {
      createdAt
      emails
      firstName
      id
      lastName
      lead {
        address
        borrowerFirstName
        borrowerLastName
        caseNumber
        city
        createdAt
        executorFirstName
        executorLastName
        id
        mailingAddress
        mailingCity
        mailingState
        mailingZip
        owner
        standardizedAddress
        state
        type
        updatedAt
        zip
        __typename
      }
      leadId
      mailingAddress
      owner
      phones
      role
      updatedAt
      __typename
    }
  }
`;
export const getEnrichment = /* GraphQL */ `
  query GetEnrichment($id: ID!) {
    getEnrichment(id: $id) {
      createdAt
      id
      lead {
        address
        borrowerFirstName
        borrowerLastName
        caseNumber
        city
        createdAt
        executorFirstName
        executorLastName
        id
        mailingAddress
        mailingCity
        mailingState
        mailingZip
        owner
        standardizedAddress
        state
        type
        updatedAt
        zip
        __typename
      }
      leadId
      owner
      payload
      source
      statusText
      updatedAt
      __typename
    }
  }
`;
export const getLead = /* GraphQL */ `
  query GetLead($id: ID!) {
    getLead(id: $id) {
      activities {
        nextToken
        __typename
      }
      address
      borrowerFirstName
      borrowerLastName
      caseNumber
      city
      contacts {
        nextToken
        __typename
      }
      createdAt
      enrichments {
        nextToken
        __typename
      }
      executorFirstName
      executorLastName
      id
      mailingAddress
      mailingCity
      mailingState
      mailingZip
      owner
      standardizedAddress
      state
      type
      updatedAt
      zip
      __typename
    }
  }
`;
export const listActivities = /* GraphQL */ `
  query ListActivities(
    $filter: ModelActivityFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listActivities(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        channel
        createdAt
        id
        leadId
        meta
        outcome
        owner
        type
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const listContacts = /* GraphQL */ `
  query ListContacts(
    $filter: ModelContactFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listContacts(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        createdAt
        emails
        firstName
        id
        lastName
        leadId
        mailingAddress
        owner
        phones
        role
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const listEnrichments = /* GraphQL */ `
  query ListEnrichments(
    $filter: ModelEnrichmentFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listEnrichments(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        createdAt
        id
        leadId
        owner
        payload
        source
        statusText
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const listLeads = /* GraphQL */ `
  query ListLeads(
    $filter: ModelLeadFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listLeads(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        address
        borrowerFirstName
        borrowerLastName
        caseNumber
        city
        createdAt
        executorFirstName
        executorLastName
        id
        mailingAddress
        mailingCity
        mailingState
        mailingZip
        owner
        standardizedAddress
        state
        type
        updatedAt
        zip
        __typename
      }
      nextToken
      __typename
    }
  }
`;
