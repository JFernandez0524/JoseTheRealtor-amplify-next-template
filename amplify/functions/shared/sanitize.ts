/**
 * INPUT SANITIZATION UTILITIES
 */

export function sanitizeId(input: string): string {
  if (!input) return '';
  
  // Remove special characters, keep alphanumeric, underscore, hyphen
  const sanitized = input.replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Limit length to prevent DynamoDB key size issues
  return sanitized.substring(0, 255);
}

export function sanitizeEmail(email: string): string {
  if (!email) return '';
  
  // Basic email sanitization
  const sanitized = email.toLowerCase().trim();
  
  // Remove special chars except @ . + -
  return sanitized.replace(/[^a-z0-9@.+_-]/g, '');
}

export function sanitizePhone(phone: string): string {
  if (!phone) return '';
  
  // Keep only digits and +
  return phone.replace(/[^0-9+]/g, '');
}
