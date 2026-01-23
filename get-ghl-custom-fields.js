#!/usr/bin/env node

/**
 * Fetch all custom fields from GHL
 * Usage: node get-ghl-custom-fields.js
 */

const { cookiesClient } = require('./app/utils/aws/auth/amplifyServerUtils.server');

async function getCustomFields() {
  try {
    // Get active GHL integration
    const { data: integrations } = await cookiesClient.models.GhlIntegration.list({
      filter: { isActive: { eq: true } }
    });

    if (!integrations || integrations.length === 0) {
      console.error('No active GHL integration found');
      process.exit(1);
    }

    const integration = integrations[0];
    const { accessToken, locationId } = integration;

    // Fetch custom fields
    const response = await fetch(
      `https://services.leadconnectorhq.com/locations/${locationId}/customFields`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Version': '2021-07-28'
        }
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      console.error('GHL API Error:', data);
      process.exit(1);
    }

    // Filter to only show custom fields (not standard fields)
    const customFields = data.customFields.filter(f => !f.standard);
    
    console.log('\n=== CUSTOM FIELDS ===\n');
    customFields.forEach(field => {
      console.log(`Name: ${field.name}`);
      console.log(`ID: ${field.id}`);
      console.log(`Field Key: ${field.fieldKey}`);
      console.log(`Data Type: ${field.dataType}`);
      console.log(`Model: ${field.model}`);
      console.log('---');
    });

    console.log(`\nTotal custom fields: ${customFields.length}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

getCustomFields();
