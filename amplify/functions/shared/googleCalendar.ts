/**
 * Google Calendar Utility
 * 
 * Handles creating, updating, and deleting calendar events using a service account.
 */

import { google } from 'googleapis';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

let cachedAuth: any = null;

/**
 * Get authenticated Google Calendar client
 */
async function getCalendarClient() {
  if (cachedAuth) {
    return google.calendar({ version: 'v3', auth: cachedAuth });
  }

  // Load service account from Secrets Manager
  const secretName = process.env.GOOGLE_SERVICE_ACCOUNT_SECRET_NAME || 'google-calendar-service-account';
  
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await secretsClient.send(command);
  
  if (!response.SecretString) {
    throw new Error('Service account secret not found');
  }

  const serviceAccount = JSON.parse(response.SecretString);

  // Create JWT auth
  cachedAuth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  return google.calendar({ version: 'v3', auth: cachedAuth });
}

/**
 * Create a calendar event from GHL task data
 */
export async function createCalendarEvent(
  taskData: {
    id: string;
    title: string;
    body?: string;
    dueDate?: string;
    contactId?: string;
  },
  contactData?: {
    name?: string;
    propertyAddress?: string;
  }
): Promise<string> {
  const calendar = await getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!calendarId) {
    throw new Error('GOOGLE_CALENDAR_ID not set');
  }

  // Build event title
  const contactName = contactData?.name || 'Unknown Contact';
  const eventTitle = `${taskData.title} - ${contactName}`;

  // Build event description
  const descriptionParts = [
    `Contact: ${contactName}`,
  ];
  
  if (contactData?.propertyAddress) {
    descriptionParts.push(`Property: ${contactData.propertyAddress}`);
  }
  
  if (taskData.body) {
    descriptionParts.push(`\nNotes: ${taskData.body}`);
  }
  
  descriptionParts.push(`\nGHL Task ID: ${taskData.id}`);

  // Parse due date or default to now + 1 hour
  const startTime = taskData.dueDate 
    ? new Date(taskData.dueDate)
    : new Date(Date.now() + 60 * 60 * 1000);
  
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

  const event = {
    summary: eventTitle,
    description: descriptionParts.join('\n'),
    start: {
      dateTime: startTime.toISOString(),
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: 'America/New_York',
    },
  };

  console.log('[GOOGLE_CALENDAR] Creating event:', eventTitle);

  const response = await calendar.events.insert({
    calendarId,
    requestBody: event,
  });

  console.log('[GOOGLE_CALENDAR] Event created:', response.data.id);

  return response.data.id || '';
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const calendar = await getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!calendarId) {
    throw new Error('GOOGLE_CALENDAR_ID not set');
  }

  console.log('[GOOGLE_CALENDAR] Deleting event:', eventId);

  await calendar.events.delete({
    calendarId,
    eventId,
  });

  console.log('[GOOGLE_CALENDAR] Event deleted');
}

/**
 * Update a calendar event (mark as completed)
 */
export async function updateCalendarEvent(
  eventId: string,
  updates: { completed?: boolean }
): Promise<void> {
  const calendar = await getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!calendarId) {
    throw new Error('GOOGLE_CALENDAR_ID not set');
  }

  console.log('[GOOGLE_CALENDAR] Updating event:', eventId);

  // Get existing event
  const existingEvent = await calendar.events.get({
    calendarId,
    eventId,
  });

  // Update summary to show completion
  if (updates.completed) {
    existingEvent.data.summary = `✅ ${existingEvent.data.summary}`;
  }

  await calendar.events.update({
    calendarId,
    eventId,
    requestBody: existingEvent.data,
  });

  console.log('[GOOGLE_CALENDAR] Event updated');
}
