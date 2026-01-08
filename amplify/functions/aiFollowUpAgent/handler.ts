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

interface Lead {
  id: string;
  owner: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  ghlContactId?: string;
  notes?: Array<{text: string, createdAt: string, createdBy?: string}>;
}

export const handler = async (event: any) => {
  console.log('🤖 AI Follow-Up Agent starting...');
  
  try {
    // 1. Get all active GHL integrations
    const integrations = await getAllActiveIntegrations();
    
    if (integrations.length === 0) {
      console.log('✅ No active GHL integrations found');
      return { statusCode: 200, processedTasks: 0 };
    }
    
    let totalProcessed = 0;
    
    // 2. Check each user's GHL tasks
    for (const integration of integrations) {
      try {
        const processed = await processUserTasks(integration);
        totalProcessed += processed;
      } catch (error) {
        console.error(`❌ Failed to process tasks for user ${integration.userId}:`, error);
      }
    }
    
    console.log(`✅ Processed ${totalProcessed} follow-up tasks across all users`);
    
    return {
      statusCode: 200,
      processedTasks: totalProcessed,
      totalIntegrations: integrations.length
    };
    
  } catch (error) {
    console.error('❌ AI Follow-Up Agent error:', error);
    return { statusCode: 500, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

async function getAllActiveIntegrations() {
  const scanParams = {
    TableName: GHL_INTEGRATION_TABLE,
    FilterExpression: 'isActive = :active',
    ExpressionAttributeValues: {
      ':active': true
    }
  };
  
  const result = await docClient.send(new ScanCommand(scanParams));
  return result.Items as GhlIntegration[] || [];
}

async function processUserTasks(integration: GhlIntegration): Promise<number> {
  // Check rate limits first
  const canSend = await checkRateLimits(integration);
  if (!canSend) {
    console.log(`🚦 Rate limit exceeded for user ${integration.userId}`);
    return 0;
  }

  // Get due tasks from GHL
  const dueTasks = await getDueTasksFromGHL(integration);
  
  if (dueTasks.length === 0) {
    return 0;
  }

  console.log(`📋 Found ${dueTasks.length} due tasks for user ${integration.userId}`);
  
  let processed = 0;
  for (const task of dueTasks) {
    try {
      await processGHLTask(task, integration);
      processed++;
    } catch (error) {
      console.error(`❌ Failed to process task ${task.id}:`, error);
    }
  }
  
  return processed;
}

async function getDueTasksFromGHL(integration: GhlIntegration) {
  try {
    const now = new Date().toISOString();
    
    // Get tasks from GHL API
    const response = await axios.get(
      'https://services.leadconnectorhq.com/contacts/tasks',
      {
        headers: {
          'Authorization': `Bearer ${integration.accessToken}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        params: {
          completed: false,
          dueBefore: now,
          limit: 50
        }
      }
    );

    // Filter for AI-created follow-up tasks
    return response.data.tasks?.filter((task: any) => 
      task.title?.includes('Follow-up:') || 
      task.body?.includes('AI Follow-up System')
    ) || [];
    
  } catch (error) {
    console.error(`❌ Error getting tasks from GHL for user ${integration.userId}:`, error);
    return [];
  }
}

async function processGHLTask(task: any, integration: GhlIntegration) {
  console.log(`🎯 Processing GHL task ${task.id}: ${task.title}`);
  
  // Determine task type from title
  const isCallTask = task.title?.includes('CALL');
  const isTextTask = task.title?.includes('TEXT');
  
  if (isTextTask) {
    // Generate AI message and send SMS
    const aiMessage = await generateFollowUpMessageFromTask(task);
    await sendGHLMessage(task.contactId, aiMessage, integration.accessToken);
    await updateRateLimitCounters(integration);
  } else if (isCallTask) {
    // Generate talking points and update task
    const talkingPoints = await generateFollowUpMessageFromTask(task);
    await updateGHLTaskWithTalkingPoints(task.id, talkingPoints, integration.accessToken);
  }
  
  // Mark task as completed in GHL
  await markGHLTaskCompleted(task.id, integration.accessToken);
  
  console.log(`✅ Completed GHL task ${task.id}`);
}

async function findLeadsWithGhlContacts(): Promise<Lead[]> {
  const scanParams = {
    TableName: PROPERTY_LEAD_TABLE,
    FilterExpression: 'attribute_exists(ghlContactId) AND ghlContactId <> :empty',
    ExpressionAttributeValues: {
      ':empty': ''
    }
  };
  
  const result = await docClient.send(new ScanCommand(scanParams));
  return result.Items as Lead[] || [];
}

async function processLeadFollowUp(lead: Lead) {
  if (!lead.ghlContactId) {
    console.log(`⏭️ Skipping lead ${lead.id} - no GHL contact ID`);
    return;
  }
  
  console.log(`🎯 Processing follow-up for lead ${lead.id}`);
  
  // 1. Get OAuth token and check rate limits
  const tokenResult = await getGhlAccessToken(lead.owner);
  if (!tokenResult) {
    console.error(`❌ No GHL access token found or rate limited for user ${lead.owner}`);
    return;
  }
  
  const { token: accessToken, integration } = tokenResult;
  
  // 2. Get tasks from GHL for this contact
  const tasksResponse = await fetch(`https://services.leadconnectorhq.com/contacts/${lead.ghlContactId}/tasks`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Version': '2021-07-28'
    }
  });

  if (!tasksResponse.ok) {
    console.error(`❌ Failed to fetch tasks for contact ${lead.ghlContactId}`);
    return;
  }

  const { tasks } = await tasksResponse.json();
  
  // 3. Find due follow-up tasks
  const dueTasks = tasks.filter((task: any) => 
    !task.completed && 
    new Date(task.dueDate) <= new Date() &&
    task.title.toLowerCase().includes('follow')
  );

  if (dueTasks.length === 0) {
    console.log(`📅 No due follow-up tasks for lead ${lead.id}`);
    return;
  }

  // 4. Process each due task
  for (const task of dueTasks) {
    console.log(`📋 Processing task: ${task.title}`);
    
    // Generate AI message based on task and lead context
    const aiMessage = await generateFollowUpMessage(lead, task);
    
    // Update task with AI-generated talking points
    await updateGHLTaskWithAI(task.id, aiMessage, accessToken);
  }
  
  console.log(`✅ Completed follow-up processing for lead ${lead.id}`);
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

async function generateFollowUpMessage(lead: Lead, task: any): Promise<string> {
  const context = {
    leadName: `${lead.ownerFirstName || ''} ${lead.ownerLastName || ''}`.trim() || 'there',
    taskTitle: task.title || '',
    taskDescription: task.body || '',
    recentNotes: (lead.notes || []).slice(-3).map(note => `${note.createdBy}: ${note.text}`).join('\n'),
    leadType: 'real estate lead'
  };
  
  const prompt = `You are a professional real estate agent following up with a lead. Generate talking points and suggestions based on this GHL task:

Lead Name: ${context.leadName}
Task Title: ${context.taskTitle}
Task Description: ${context.taskDescription}
Recent Notes:
${context.recentNotes}

Requirements:
- Generate helpful talking points and suggestions for this task
- Be professional and actionable
- Include specific next steps or questions to ask
- Keep it concise but comprehensive
- Focus on moving the lead forward

AI Suggestions:`;

  const modelInput = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 300,
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

async function updateGHLTaskWithAI(taskId: string, aiSuggestions: string, accessToken: string) {
  // Update the existing task with AI-generated suggestions
  const updateData = {
    body: `${aiSuggestions}\n\n--- Original Task ---\n[Task content preserved by AI agent]`
  };
  
  const ghlResponse = await axios.put(
    `https://services.leadconnectorhq.com/tasks/${taskId}`,
    updateData,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      }
    }
  );
  
  console.log(`🤖 Updated task ${taskId} with AI suggestions`);
  return ghlResponse.data;
}
