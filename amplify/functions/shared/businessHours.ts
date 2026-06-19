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
 * - Uses America/New_York timezone via Intl API (handles EST/EDT automatically)
 * - Returns helpful messages about next available time
 */

function getEasternTime(now: Date): { dayOfWeek: number; hour: number } {
  // Use Intl to get correct Eastern time accounting for EST/EDT automatically
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(now);

  const weekdayStr = parts.find(p => p.type === 'weekday')?.value ?? '';
  const hourStr = parts.find(p => p.type === 'hour')?.value ?? '0';

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  return {
    dayOfWeek: weekdayMap[weekdayStr] ?? 0,
    // hour12:false returns 24 for midnight in some locales; normalize to 0
    hour: parseInt(hourStr, 10) % 24,
  };
}

export function isWithinBusinessHours(): boolean {
  const { dayOfWeek, hour } = getEasternTime(new Date());

  if (dayOfWeek === 0) return false; // Sunday

  if (dayOfWeek === 6) return hour >= 9 && hour < 12; // Saturday 9 AM–12 PM

  return hour >= 9 && hour < 19; // Mon–Fri 9 AM–7 PM
}

export function getNextBusinessHourMessage(): string {
  const { dayOfWeek, hour } = getEasternTime(new Date());

  if (dayOfWeek === 0) {
    return 'Sunday - closed. Next business hours: Monday 9 AM Eastern';
  }

  if (dayOfWeek === 6) {
    if (hour >= 12) {
      return 'Saturday after hours. Next business hours: Monday 9 AM Eastern';
    }
    return `Saturday - open until 12 PM Eastern (currently ${hour}:00)`;
  }

  if (hour < 9) {
    return 'Before business hours. Opens at 9 AM Eastern';
  }

  if (hour >= 19) {
    if (dayOfWeek === 5) {
      return 'Friday after hours. Next business hours: Saturday 9 AM Eastern';
    }
    return 'After business hours. Next business hours: tomorrow 9 AM Eastern';
  }

  return `Within business hours (9 AM - 7 PM Eastern)`;
}
