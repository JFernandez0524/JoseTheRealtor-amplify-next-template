import { LexRuntimeV2Client, RecognizeTextCommand } from '@aws-sdk/client-lex-runtime-v2';

const lexClient = new LexRuntimeV2Client({ region: process.env.AWS_REGION });

export async function POST(request: Request) {
  try {
    const { message, contactId, testMode } = await request.json();
    
    if (!testMode) {
      return Response.json({ error: 'Test mode required' }, { status: 400 });
    }
    
    // Call Lex V2
    const lexResponse = await lexClient.send(new RecognizeTextCommand({
      botId: process.env.LEX_BOT_ID || 'test-bot-id',
      botAliasId: process.env.LEX_BOT_ALIAS_ID || 'TSTALIASID',
      localeId: 'en_US',
      sessionId: `test-${contactId}-${Date.now()}`,
      text: message
    }));
    
    const botResponse = lexResponse.messages?.[0]?.content || 'I need more information to help you.';
    const intent = lexResponse.sessionState?.intent?.name || 'Unknown';
    
    return Response.json({
      success: true,
      lexResponse: botResponse,
      intent: intent,
      confidence: lexResponse.sessionState?.intent?.confirmationState,
      sessionId: lexResponse.sessionId
    });
    
  } catch (error: any) {
    console.error('Lex V2 test error:', error);
    return Response.json({
      success: false,
      error: error.message,
      fallback: 'Lex V2 not configured yet - using OpenAI fallback'
    });
  }
}
