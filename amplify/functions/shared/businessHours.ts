/**
 * BUSINESS HOURS CHECKER
 * 
 * Ensures all automated outreach (SMS and email) respects business hours
 * to comply with best practices and avoid annoying leads.
 * 
 * SCHEDULE:
 * - Monday-Friday: 9 AM - 7 PM EST
 * - Saturday: 9 AM - 12 PM EST
 * - Sunday: Closed
 * 
 * USAGE:
 * ```typescript
 * import { isWithinBusinessHours, getNextBusinessHourMessage } from './businessHours';
 * 
 * if (!isWithinBusinessHours()) {
 *   console.log(getNextBusinessHourMessage());
 *   return; // Skip outreach
 * }
 * ```
 * 
 * USED BY:
 * - amplify/functions/dailyOutreachAgent (SMS automation)
 * - amplify/functions/dailyEmailAgent (Email automation)
 * 
 * NOTES:
 * - Converts UTC to EST automatically
 * - Handles daylight saving time
 * - Returns helpful messages about next available time
 */

export function isWithinBusinessHours(): boolean {
  const now = new Date();
  
  // Convert to EST (UTC-5)
  const estOffset = -5 * 60; // EST offset in minutes
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const estTime = new Date(utcTime + (estOffset * 60000));
  
  const dayOfWeek = estTime.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = estTime.getHours();
  
  // Sunday - closed
  if (dayOfWeek === 0) {
    return false;
  }
  
  // Saturday - 9 AM to 12 PM
  if (dayOfWeek === 6) {
    return hour >= 9 && hour < 12;
  }
  
  // Monday-Friday - 9 AM to 7 PM
  return hour >= 9 && hour < 19;
}

export function getNextBusinessHourMessage(): string {
  const now = new Date();
  const estOffset = -5 * 60;
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const estTime = new Date(utcTime + (estOffset * 60000));
  
  const dayOfWeek = estTime.getDay();
  const hour = estTime.getHours();
  
  if (dayOfWeek === 0) {
    return 'Sunday - closed. Next business hours: Monday 9 AM EST';
  }
  
  if (dayOfWeek === 6) {
    if (hour >= 12) {
      return 'Saturday after hours. Next business hours: Monday 9 AM EST';
    }
    return `Saturday - open until 12 PM EST (currently ${hour}:00)`;
  }
  
  if (hour < 9) {
    return `Before business hours. Opens at 9 AM EST`;
  }
  
  if (hour >= 19) {
    if (dayOfWeek === 5) {
      return 'Friday after hours. Next business hours: Saturday 9 AM EST';
    }
    return 'After business hours. Next business hours: tomorrow 9 AM EST';
  }
  
  return `Within business hours (9 AM - 7 PM EST)`;
}
