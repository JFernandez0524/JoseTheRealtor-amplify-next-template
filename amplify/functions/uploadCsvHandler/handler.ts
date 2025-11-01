import type { Handler } from 'aws-lambda';
import { cookiesClient } from '../../../app/src/utils/amplifyServerUtils.server';
import { syncToKVCore } from './src/intergrations/kvcore';
import { syncToGoHighLevel } from './src/intergrations/gohighlevel';
import { sendNotification } from './src/intergrations/notifications';
import { logAuditEvent } from './src/intergrations/auditLogs';

export const handler: Handler = async (event, context) => {
  // Call client for server
  const client = cookiesClient;

  try {
    const { leads } = JSON.parse(event.body || '{}');
    if (!Array.isArray(leads) || leads.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No leads provided' }),
      };
    }

    for (const lead of leads) {
      const { data: createdLead } = await client.models.Lead.create({
        ...lead,
        createdAt: new Date(),
      });

      // 🔌 Integration hooks
      await Promise.all([
        syncToKVCore(createdLead),
        syncToGoHighLevel(createdLead),
        sendNotification(createdLead, 'Lead successfully imported'),
        logAuditEvent(createdLead, 'CREATE_LEAD'),
      ]);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Leads stored & synced successfully' }),
    };
  } catch (error: any) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Lambda execution failed' }),
    };
  }
};
