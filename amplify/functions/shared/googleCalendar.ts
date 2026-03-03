/**
 * Google Calendar Utility (REST API)
 * 
 * Handles creating, updating, and deleting calendar events using direct REST API calls.
 * Uses service account authentication without the heavy googleapis SDK.
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { createSign } from 'crypto';

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Get OAuth access token using service account JWT
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const secretName = process.env.GOOGLE_SERVICE_ACCOUNT_SECRET_NAME || 'google-calendar-service-account';
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await secretsClient.send(command);
  
  if (!response.SecretString) {
    throw new Error('Service account secret not found');
  }

  const serviceAccount = JSON.parse(response.SecretString);

  // Create JWT
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');

  const signatureInput = `${header}.${claim}`;
  const sign = createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(serviceAccount.private_key, 'base64url');
  const jwt = `${signatureInput}.${signature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  cachedToken = tokenData.access_token;
  tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 60000;

  return cachedToken;
}

/**
 * Create a calendar event from GHL task data
 */
export async function createCalendarEvent(
  taskData: {
    id: string;
    title: string;
    body?: string;
    dueDate: string;
    assignedToEmail: string;
  },
  calendarId: string
): Promise<string> {
  const token = await getAccessToken();
  
  const event = {
    summary: taskData.title,
    description: taskData.body || '',
    start: {
      dateTime: taskData.dueDate,
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: new Date(new Date(taskData.dueDate).getTime() + 30 * 60000).toISOString(),
      timeZone: 'America/New_York',
    },
    extendedProperties: {
      private: {
        ghlTaskId: taskData.id,
      },
    },
  };

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create calendar event: ${error}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Update calendar event to mark as completed
 */
export async function markEventCompleted(
  eventId: string,
  calendarId: string
): Promise<void> {
  const token = await getAccessToken();

  // Get existing event
  const getResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!getResponse.ok) {
    throw new Error('Event not found');
  }

  const event = await getResponse.json();

  // Update with checkmark
  event.summary = `✅ ${event.summary.replace(/^✅\s*/, '')}`;

  const updateResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!updateResponse.ok) {
    const error = await updateResponse.text();
    throw new Error(`Failed to update event: ${error}`);
  }
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(
  eventId: string,
  calendarId: string
): Promise<void> {
  const token = await getAccessToken();

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    throw new Error(`Failed to delete event: ${error}`);
  }
}
