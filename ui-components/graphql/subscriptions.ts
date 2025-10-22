/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onCreateActivity = /* GraphQL */ `
  subscription OnCreateActivity(
    $filter: ModelSubscriptionActivityFilterInput
    $owner: String
  ) {
    onCreateActivity(filter: $filter, owner: $owner) {
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
export const onCreateContact = /* GraphQL */ `
  subscription OnCreateContact(
    $filter: ModelSubscriptionContactFilterInput
    $owner: String
  ) {
    onCreateContact(filter: $filter, owner: $owner) {
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
export const onCreateEnrichment = /* GraphQL */ `
  subscription OnCreateEnrichment(
    $filter: ModelSubscriptionEnrichmentFilterInput
    $owner: String
  ) {
    onCreateEnrichment(filter: $filter, owner: $owner) {
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
export const onCreateLead = /* GraphQL */ `
  subscription OnCreateLead(
    $filter: ModelSubscriptionLeadFilterInput
    $owner: String
  ) {
    onCreateLead(filter: $filter, owner: $owner) {
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
export const onDeleteActivity = /* GraphQL */ `
  subscription OnDeleteActivity(
    $filter: ModelSubscriptionActivityFilterInput
    $owner: String
  ) {
    onDeleteActivity(filter: $filter, owner: $owner) {
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
export const onDeleteContact = /* GraphQL */ `
  subscription OnDeleteContact(
    $filter: ModelSubscriptionContactFilterInput
    $owner: String
  ) {
    onDeleteContact(filter: $filter, owner: $owner) {
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
export const onDeleteEnrichment = /* GraphQL */ `
  subscription OnDeleteEnrichment(
    $filter: ModelSubscriptionEnrichmentFilterInput
    $owner: String
  ) {
    onDeleteEnrichment(filter: $filter, owner: $owner) {
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
export const onDeleteLead = /* GraphQL */ `
  subscription OnDeleteLead(
    $filter: ModelSubscriptionLeadFilterInput
    $owner: String
  ) {
    onDeleteLead(filter: $filter, owner: $owner) {
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
export const onUpdateActivity = /* GraphQL */ `
  subscription OnUpdateActivity(
    $filter: ModelSubscriptionActivityFilterInput
    $owner: String
  ) {
    onUpdateActivity(filter: $filter, owner: $owner) {
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
export const onUpdateContact = /* GraphQL */ `
  subscription OnUpdateContact(
    $filter: ModelSubscriptionContactFilterInput
    $owner: String
  ) {
    onUpdateContact(filter: $filter, owner: $owner) {
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
export const onUpdateEnrichment = /* GraphQL */ `
  subscription OnUpdateEnrichment(
    $filter: ModelSubscriptionEnrichmentFilterInput
    $owner: String
  ) {
    onUpdateEnrichment(filter: $filter, owner: $owner) {
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
export const onUpdateLead = /* GraphQL */ `
  subscription OnUpdateLead(
    $filter: ModelSubscriptionLeadFilterInput
    $owner: String
  ) {
    onUpdateLead(filter: $filter, owner: $owner) {
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
