import axios from 'axios';
import { config } from '../config';

export async function sendNotification(lead: any, message: string) {
  if (!config.notificationWebhook) return;

  try {
    await axios.post(config.notificationWebhook, {
      text: `📬 New Lead: ${lead.address}\n${message}`,
    });
  } catch (error: any) {
    console.error('❌ Notification failed:', error.message);
  }
}
