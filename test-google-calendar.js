const { google } = require('googleapis');
const fs = require('fs');

// Load the service account key from the downloaded JSON file
const serviceAccountKey = JSON.parse(
  fs.readFileSync('./google-service-account-key.json', 'utf8')
);

// Your calendar ID (from Step 5)
const CALENDAR_ID = 'jose.fernandez@JoseTheRealtor.com'; // Replace with your actual calendar ID

async function testCalendarAccess() {
  try {
    // Create JWT client
    const auth = new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    // Create calendar client
    const calendar = google.calendar({ version: 'v3', auth });

    // Create a test event
    const event = {
      summary: '🧪 Test Event from GHL Task Sync',
      description: 'This is a test event to verify service account access',
      start: {
        dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        timeZone: 'America/New_York',
      },
    };

    console.log('Creating test event...');
    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      resource: event,
    });

    console.log('✅ Success! Event created:');
    console.log('Event ID:', response.data.id);
    console.log('Event Link:', response.data.htmlLink);
    console.log('\nCheck your Google Calendar - you should see the test event!');

    return response.data.id;
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 403) {
      console.error('\n⚠️  Permission denied. Make sure you:');
      console.error('1. Shared your calendar with the service account email');
      console.error('2. Gave it "Make changes to events" permission');
    }
  }
}

testCalendarAccess();
