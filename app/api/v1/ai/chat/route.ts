// app/api/v1/ai/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runWithAmplifyServerContext } from '@/src/utils/amplifyServerUtils.server';
import { cookies } from 'next/headers';
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '@/amplify/data/resource';

export const dynamic = 'force-dynamic';

import { fetchAuthSession } from 'aws-amplify/auth/server';

export async function POST(req: NextRequest) {
  try {
    const { message, conversationId } = await req.json();

    // 👇 this is the magic: we run our logic INSIDE Amplify's server context,
    // so it can read the user's auth cookies and sign calls correctly
    const result = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: async () => {
        const client = generateClient<Schema>({
          authMode: 'userPool', // act as the signed-in Cognito user
        });

        // reuse or create conversation
        let chat;
        if (conversationId) {
          const { data } = await client.conversations.chat.get({
            id: conversationId,
          });
          chat = data;
        } else {
          const { data, errors } = await client.conversations.chat.create();
          if (errors?.length) {
            throw new Error(JSON.stringify(errors));
          }
          chat = data;
        }

        if (!chat) {
          throw new Error('No chat available');
        }

        // send user's message to the AI
        const { data: messageData, errors: sendErrors } =
          await chat.sendMessage(message);
        if (sendErrors?.length) {
          throw new Error(JSON.stringify(sendErrors));
        }

        return {
          conversationId: chat.id,
          reply: messageData?.content?.[0]?.text ?? '',
        };
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('❌ Chat API Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
