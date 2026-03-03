/**
 * Test Google Calendar utility functions
 * 
 * Run with: tsx test-calendar-utils.ts
 */

// Set environment variables for testing
process.env.GOOGLE_CALENDAR_ID = 'jose.fernandez@josetherealtor.com'; // Replace with your calendar ID
process.env.AWS_REGION = 'us-east-1';
process.env.GOOGLE_SERVICE_ACCOUNT_SECRET_NAME = 'google-calendar-service-account';

import { createCalendarEvent, deleteCalendarEvent, markEventCompleted } from './amplify/functions/shared/googleCalendar';

async function testCalendarUtils() {
  console.log('🧪 Testing Google Calendar utilities...\n');

  try {
    // Test 1: Create event
    console.log('Test 1: Creating calendar event...');
    const eventId = await createCalendarEvent(
      {
        id: 'test-task-123',
        title: 'Follow up with lead',
        body: 'Discuss property options and schedule viewing',
        dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        assignedToEmail: 'jose.fernandez@josetherealtor.com',
      },
      calendarId
    );
    console.log('✅ Event created:', eventId);
    console.log('');

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Update event (mark completed)
    console.log('Test 2: Marking event as completed...');
    await markEventCompleted(eventId, calendarId);
    console.log('✅ Event marked as completed');
    console.log('');

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Delete event
    console.log('Test 3: Deleting event...');
    await deleteCalendarEvent(eventId);
    console.log('✅ Event deleted');
    console.log('');

    console.log('🎉 All tests passed! Check your Google Calendar to verify.');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

testCalendarUtils();
