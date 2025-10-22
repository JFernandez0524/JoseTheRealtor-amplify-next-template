/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createActivity = /* GraphQL */ `
  mutation CreateActivity(
    $condition: ModelActivityConditionInput
    $input: CreateActivityInput!
  ) {
    createActivity(condition: $condition, input: $input) {
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
export const createContact = /* GraphQL */ `
  mutation CreateContact(
    $condition: ModelContactConditionInput
    $input: CreateContactInput!
  ) {
    createContact(condition: $condition, input: $input) {
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
export const createEnrichment = /* GraphQL */ `
  mutation CreateEnrichment(
    $condition: ModelEnrichmentConditionInput
    $input: CreateEnrichmentInput!
  ) {
    createEnrichment(condition: $condition, input: $input) {
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
export const createLead = /* GraphQL */ `
  mutation CreateLead(
    $condition: ModelLeadConditionInput
    $input: CreateLeadInput!
  ) {
    createLead(condition: $condition, input: $input) {
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
export const deleteActivity = /* GraphQL */ `
  mutation DeleteActivity(
    $condition: ModelActivityConditionInput
    $input: DeleteActivityInput!
  ) {
    deleteActivity(condition: $condition, input: $input) {
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
export const deleteContact = /* GraphQL */ `
  mutation DeleteContact(
    $condition: ModelContactConditionInput
    $input: DeleteContactInput!
  ) {
    deleteContact(condition: $condition, input: $input) {
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
export const deleteEnrichment = /* GraphQL */ `
  mutation DeleteEnrichment(
    $condition: ModelEnrichmentConditionInput
    $input: DeleteEnrichmentInput!
  ) {
    deleteEnrichment(condition: $condition, input: $input) {
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
export const deleteLead = /* GraphQL */ `
  mutation DeleteLead(
    $condition: ModelLeadConditionInput
    $input: DeleteLeadInput!
  ) {
    deleteLead(condition: $condition, input: $input) {
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
export const updateActivity = /* GraphQL */ `
  mutation UpdateActivity(
    $condition: ModelActivityConditionInput
    $input: UpdateActivityInput!
  ) {
    updateActivity(condition: $condition, input: $input) {
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
export const updateContact = /* GraphQL */ `
  mutation UpdateContact(
    $condition: ModelContactConditionInput
    $input: UpdateContactInput!
  ) {
    updateContact(condition: $condition, input: $input) {
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
export const updateEnrichment = /* GraphQL */ `
  mutation UpdateEnrichment(
    $condition: ModelEnrichmentConditionInput
    $input: UpdateEnrichmentInput!
  ) {
    updateEnrichment(condition: $condition, input: $input) {
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
export const updateLead = /* GraphQL */ `
  mutation UpdateLead(
    $condition: ModelLeadConditionInput
    $input: UpdateLeadInput!
  ) {
    updateLead(condition: $condition, input: $input) {
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
