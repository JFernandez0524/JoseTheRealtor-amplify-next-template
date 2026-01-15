/**
 * Migration script to fix zestimateDate format
 * Run with: npx tsx scripts/fix-zestimate-dates.ts
 */

import { generateServerClientUsingCookies } from '@aws-amplify/adapter-nextjs/api';
import { cookies } from 'next/headers';
import config from '../amplify_outputs.json';
import { Schema } from '../amplify/data/resource';

const cookiesClient = generateServerClientUsingCookies<Schema>({
  config,
  cookies,
});

async function fixDates() {
  console.log('Fetching all leads...');
  
  let allLeads: any[] = [];
  let token: string | null | undefined = undefined;

  // Fetch all leads (even with errors)
  do {
    try {
      const result = await cookiesClient.models.PropertyLead.list({
        selectionSet: ['id', 'zestimateDate'],
      });
      
      if (result.data) {
        allLeads = allLeads.concat(result.data);
      }
      token = result.nextToken;
    } catch (e) {
      console.error('Error fetching batch:', e);
      break;
    }
  } while (token);

  console.log(`Found ${allLeads.length} leads`);
  
  // Update each lead to fix the date
  for (const lead of allLeads) {
    if (lead.zestimateDate) {
      try {
        // The date is already in ISO format, just needs to be re-saved
        await cookiesClient.models.PropertyLead.update({
          id: lead.id,
          zestimateDate: lead.zestimateDate,
        });
        console.log(`✓ Fixed lead ${lead.id}`);
      } catch (e) {
        console.error(`✗ Failed to fix lead ${lead.id}:`, e);
      }
    }
  }
  
  console.log('Migration complete!');
}

fixDates();
