import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import axios from 'axios';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const bedrockClient = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'us-east-1' });

// 🚦 RATE LIMITING CONSTANTS
const MAX_MESSAGES_PER_HOUR = 10;  // Conservative limit
const MAX_MESSAGES_PER_DAY = 50;   // Daily limit
const MIN_MESSAGE_INTERVAL_MINUTES = 5; // 5 minutes between messages

interface GhlIntegration {
  id: string;
  userId: string;
  accessToken: string;
  expiresAt: string;
  dailyMessageCount?: number;
  hourlyMessageCount?: number;
  lastMessageSent?: string;
  lastHourReset?: string;
  lastDayReset?: string;
}

interface FollowUpTask {
  taskDate: string;
  taskTime: string;
  taskType: 'call' | 'text';
  description: string;
  status: 'pending' | 'completed';
  ghlTaskId?: string;
}

interface Lead {
  id: string;
  owner: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  ghlContactId?: string;
  notes?: Array<{text: string, createdAt: string, createdBy?: string}>;
  followUpTask?: FollowUpTask;
  followUpDueAt?: string;
}

export const handler = async (event: any) => {
  console.log('🤖 AI Follow-Up Agent starting...');
  
  try {
    // 1. Find leads with pending follow-ups that are due
    const dueLeads = await findDueFollowUps();
    
    if (dueLeads.length === 0) {
      console.log('✅ No follow-ups due at this time');
      return { statusCode: 200, processedLeads: 0 };
    }
    
    console.log(`📋 Found ${dueLeads.length} leads with due follow-ups`);
    
    // 2. Process each lead
    let processedCount = 0;
    for (const lead of dueLeads) {
      try {
        await processLeadFollowUp(lead);
        processedCount++;
      } catch (error) {
        console.error(`❌ Failed to process lead ${lead.id}:`, error);
      }
    }
    
    console.log(`✅ Processed ${processedCount}/${dueLeads.length} follow-ups`);
    
    return {
      statusCode: 200,
      processedLeads: processedCount,
      totalDue: dueLeads.length
    };
    
  } catch (error) {
    console.error('❌ AI Follow-Up Agent error:', error);
    return { statusCode: 500, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

async function findDueFollowUps(): Promise<Lead[]> {
  const now = new Date().toISOString();
  
  const scanParams = {
    TableName: PROPERTY_LEAD_TABLE,
    FilterExpression: 'followUpDueAt <= :now AND attribute_exists(followUpTask) AND followUpTask.#status = :pending',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':now': now,
      ':pending': 'pending'
    }
  };
  
  const result = await docClient.send(new ScanCommand(scanParams));
  return result.Items as Lead[] || [];
}

async function processLeadFollowUp(lead: Lead) {
  if (!lead.followUpTask || !lead.ghlContactId) {
    console.log(`⏭️ Skipping lead ${lead.id} - missing task or GHL contact`);
    return;
  }
  
  console.log(`🎯 Processing follow-up for lead ${lead.id} (${lead.followUpTask.taskType})`);
  
  // 1. Get OAuth token and check rate limits
  const tokenResult = await getGhlAccessToken(lead.owner);
  if (!tokenResult) {
    console.error(`❌ No GHL access token found or rate limited for user ${lead.owner}`);
    return;
  }
  
  const { token: accessToken, integration } = tokenResult;
  
  // 2. Generate AI message based on context
  const aiMessage = await generateFollowUpMessage(lead);
  
  // 3. Send message via GHL (only for text messages - calls create tasks)
  if (lead.followUpTask.taskType === 'text') {
    await sendGHLMessage(lead.ghlContactId, aiMessage, accessToken);
    // Update rate limit counters after successful send
    await updateRateLimitCounters(integration);
  } else {
    // For calls, create a task in GHL (doesn't count against rate limits)
    await createGHLTask(lead.ghlContactId, aiMessage, lead.followUpTask, accessToken);
  }
  
  // 4. Mark follow-up as completed
  await markFollowUpCompleted(lead.id);
  
  console.log(`✅ Completed follow-up for lead ${lead.id}`);
}

const PROPERTY_LEAD_TABLE = process.env.AMPLIFY_DATA_PropertyLead_TABLE_NAME;
const GHL_INTEGRATION_TABLE = process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME;

async function getGhlAccessToken(userId: string): Promise<{token: string, integration: GhlIntegration} | null> {
  try {
    const scanParams = {
      TableName: GHL_INTEGRATION_TABLE,
      FilterExpression: 'userId = :userId AND isActive = :active',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':active': true
      }
    };
    
    const result = await docClient.send(new ScanCommand(scanParams));
    
    if (result.Items && result.Items.length > 0) {
      const integration = result.Items[0] as GhlIntegration;
      
      // Check if token is expired
      if (new Date(integration.expiresAt) < new Date()) {
        console.log(`🔄 Token expired for user ${userId}, needs refresh`);
        return null;
      }
      
      // Check rate limits
      const canSend = await checkRateLimits(integration);
      if (!canSend) {
        console.log(`🚦 Rate limit exceeded for user ${userId}`);
        return null;
      }
      
      return { token: integration.accessToken, integration };
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error getting GHL token for user ${userId}:`, error);
    return null;
  }
}

async function checkRateLimits(integration: GhlIntegration): Promise<boolean> {
  const now = new Date();
  const nowISO = now.toISOString();
  
  // Reset counters if needed
  const lastHourReset = integration.lastHourReset ? new Date(integration.lastHourReset) : new Date(0);
  const lastDayReset = integration.lastDayReset ? new Date(integration.lastDayReset) : new Date(0);
  const lastMessageSent = integration.lastMessageSent ? new Date(integration.lastMessageSent) : new Date(0);
  
  let hourlyCount = integration.hourlyMessageCount || 0;
  let dailyCount = integration.dailyMessageCount || 0;
  
  // Reset hourly counter if an hour has passed
  if (now.getTime() - lastHourReset.getTime() > 60 * 60 * 1000) {
    hourlyCount = 0;
  }
  
  // Reset daily counter if a day has passed
  if (now.getTime() - lastDayReset.getTime() > 24 * 60 * 60 * 1000) {
    dailyCount = 0;
  }
  
  // Check if minimum interval has passed since last message
  const minutesSinceLastMessage = (now.getTime() - lastMessageSent.getTime()) / (1000 * 60);
  if (minutesSinceLastMessage < MIN_MESSAGE_INTERVAL_MINUTES) {
    console.log(`⏰ Must wait ${MIN_MESSAGE_INTERVAL_MINUTES - minutesSinceLastMessage} more minutes`);
    return false;
  }
  
  // Check limits
  if (hourlyCount >= MAX_MESSAGES_PER_HOUR) {
    console.log(`🚦 Hourly limit reached: ${hourlyCount}/${MAX_MESSAGES_PER_HOUR}`);
    return false;
  }
  
  if (dailyCount >= MAX_MESSAGES_PER_DAY) {
    console.log(`🚦 Daily limit reached: ${dailyCount}/${MAX_MESSAGES_PER_DAY}`);
    return false;
  }
  
  return true;
}

async function updateRateLimitCounters(integration: GhlIntegration) {
  const now = new Date();
  const nowISO = now.toISOString();
  
  const lastHourReset = integration.lastHourReset ? new Date(integration.lastHourReset) : new Date(0);
  const lastDayReset = integration.lastDayReset ? new Date(integration.lastDayReset) : new Date(0);
  
  let hourlyCount = integration.hourlyMessageCount || 0;
  let dailyCount = integration.dailyMessageCount || 0;
  let hourReset = integration.lastHourReset || nowISO;
  let dayReset = integration.lastDayReset || nowISO;
  
  // Reset counters if needed
  if (now.getTime() - lastHourReset.getTime() > 60 * 60 * 1000) {
    hourlyCount = 0;
    hourReset = nowISO;
  }
  
  if (now.getTime() - lastDayReset.getTime() > 24 * 60 * 60 * 1000) {
    dailyCount = 0;
    dayReset = nowISO;
  }
  
  // Increment counters
  hourlyCount++;
  dailyCount++;
  
  // Update database
  await docClient.send(new UpdateCommand({
    TableName: GHL_INTEGRATION_TABLE,
    Key: { id: integration.id },
    UpdateExpression: 'SET hourlyMessageCount = :hourly, dailyMessageCount = :daily, lastMessageSent = :lastSent, lastHourReset = :hourReset, lastDayReset = :dayReset',
    ExpressionAttributeValues: {
      ':hourly': hourlyCount,
      ':daily': dailyCount,
      ':lastSent': nowISO,
      ':hourReset': hourReset,
      ':dayReset': dayReset
    }
  }));
  
  console.log(`📊 Rate limits updated: ${hourlyCount}/${MAX_MESSAGES_PER_HOUR} hourly, ${dailyCount}/${MAX_MESSAGES_PER_DAY} daily`);
}

async function generateFollowUpMessage(lead: Lead): Promise<string> {
  const context = {
    leadName: `${lead.ownerFirstName || ''} ${lead.ownerLastName || ''}`.trim() || 'there',
    taskDescription: lead.followUpTask?.description || '',
    taskType: lead.followUpTask?.taskType || 'text',
    recentNotes: (lead.notes || []).slice(-3).map(note => `${note.createdBy}: ${note.text}`).join('\n'),
    leadType: 'real estate lead' // You can enhance this with actual lead type
  };
  
  const prompt = `You are a professional real estate agent following up with a lead. Generate a ${context.taskType === 'call' ? 'call script with talking points' : 'text message'} based on this context:

Lead Name: ${context.leadName}
Follow-up Task: ${context.taskDescription}
Recent Notes:
${context.recentNotes}

Requirements:
- Be professional and personable
- Reference the specific follow-up task
- Keep it concise (${context.taskType === 'text' ? '160 characters max' : '2-3 key talking points'})
- Include a clear call-to-action
- Sound natural and conversational

${context.taskType === 'call' ? 'Call Script:' : 'Text Message:'}`;

  const modelInput = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  };

  const command = new InvokeModelCommand({
    modelId: process.env.BEDROCK_MODEL_ID,
    body: JSON.stringify(modelInput),
    contentType: 'application/json'
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  
  return responseBody.content[0].text;
}

async function sendGHLMessage(contactId: string, message: string, accessToken: string) {
  const ghlResponse = await axios.post(
    `https://services.leadconnectorhq.com/conversations/messages`,
    {
      type: 'SMS',
      contactId: contactId,
      message: message
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      }
    }
  );
  
  console.log(`📱 Sent SMS to contact ${contactId}`);
  return ghlResponse.data;
}

async function createGHLTask(contactId: string, talkingPoints: string, task: FollowUpTask, accessToken: string) {
  // Create a task in GHL for the agent to make the call
  const taskData = {
    title: `Follow-up Call: ${task.description}`,
    body: `AI-Generated Talking Points:\n\n${talkingPoints}`,
    contactId: contactId,
    dueDate: new Date().toISOString(), // Due now
    completed: false
  };
  
  const ghlResponse = await axios.post(
    `https://services.leadconnectorhq.com/contacts/${contactId}/tasks`,
    taskData,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      }
    }
  );
  
  console.log(`📞 Created call task for contact ${contactId}`);
  return ghlResponse.data;
}

async function markFollowUpCompleted(leadId: string) {
  await docClient.send(new UpdateCommand({
    TableName: PROPERTY_LEAD_TABLE,
    Key: { id: leadId },
    UpdateExpression: 'SET followUpTask.#status = :completed',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':completed': 'completed'
    }
  }));
}
