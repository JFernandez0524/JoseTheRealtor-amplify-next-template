/**
 * Environment Variable Validator
 * Validates required environment variables at Lambda initialization.
 * Fails fast with descriptive error if any required vars are missing.
 */

interface EnvConfig {
  required: string[];
}

const LAMBDA_ENV_CONFIGS: Record<string, EnvConfig> = {
  ghlWebhookHandler: {
    required: [
      'AMPLIFY_DATA_GhlIntegration_TABLE_NAME',
      'AMPLIFY_DATA_OutreachQueue_TABLE_NAME',
      'GHL_CLIENT_ID',
      'GHL_CLIENT_SECRET',
      'OPENAI_API_KEY',
      'AWS_REGION'
    ]
  },
  dailyOutreachAgent: {
    required: [
      'AMPLIFY_DATA_GhlIntegration_TABLE_NAME',
      'AMPLIFY_DATA_OutreachQueue_TABLE_NAME',
      'API_ENDPOINT',
      'AWS_REGION'
    ]
  },
  dailyEmailAgent: {
    required: [
      'AMPLIFY_DATA_GhlIntegration_TABLE_NAME',
      'AMPLIFY_DATA_OutreachQueue_TABLE_NAME',
      'APP_URL',
      'AWS_REGION'
    ]
  },
  skiptraceLeads: {
    required: [
      'AMPLIFY_DATA_PropertyLead_TABLE_NAME',
      'BATCH_DATA_SERVER_TOKEN',
      'AWS_REGION'
    ]
  },
  manualGhlSync: {
    required: [
      'AMPLIFY_DATA_PropertyLead_TABLE_NAME',
      'AMPLIFY_DATA_UserAccount_TABLE_NAME',
      'AMPLIFY_DATA_GhlIntegration_TABLE_NAME',
      'AMPLIFY_DATA_OutreachQueue_TABLE_NAME',
      'GHL_CLIENT_ID',
      'GHL_CLIENT_SECRET',
      'AWS_REGION'
    ]
  }
};

export function validateEnv(lambdaName: keyof typeof LAMBDA_ENV_CONFIGS): void {
  const config = LAMBDA_ENV_CONFIGS[lambdaName];
  
  if (!config) {
    console.warn(`⚠️ No env validation config for Lambda: ${lambdaName}`);
    return;
  }

  const missing = config.required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    const error = `❌ ENVIRONMENT VALIDATION FAILED for ${lambdaName}\n` +
                  `Missing required environment variables:\n` +
                  missing.map(key => `  - ${key}`).join('\n');
    
    console.error(error);
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  console.log(`✅ Environment validation passed for ${lambdaName}`);
}

export function validateSharedEnv(required: string[]): void {
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
