/**
 * STRUCTURED ERROR LOGGER
 */

export function logError(context: string, error: any, metadata?: Record<string, any>): void {
  console.error(JSON.stringify({
    level: 'ERROR',
    context,
    message: error.message,
    stack: error.stack,
    metadata,
    timestamp: new Date().toISOString(),
    requestId: process.env.AWS_REQUEST_ID
  }));
}

export function logWarning(context: string, message: string, metadata?: Record<string, any>): void {
  console.warn(JSON.stringify({
    level: 'WARN',
    context,
    message,
    metadata,
    timestamp: new Date().toISOString()
  }));
}
