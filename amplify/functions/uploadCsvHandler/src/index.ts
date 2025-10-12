import type { Handler } from 'aws-lambda';
import { client } from '../../../../src/lib/amplifyClient.server';
import { syncToKVCore } from './intergrations/kvcore';
import { syncToGoHighLevel } from './intergrations/gohighlevel';
import { sendNotification } from './intergrations/notifications';
import { logAuditEvent } from './intergrations/auditLogs';

export const handler: Handler = async (event, context) => {
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
