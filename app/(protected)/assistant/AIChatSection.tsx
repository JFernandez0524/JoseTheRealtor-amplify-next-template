'use client';

import { useAIConversation } from '@/src/lib/amplifyAIHooks';
import { AIConversation } from '@aws-amplify/ui-react-ai';

export default function AIChatSection() {
  const [
    { data: { messages } = { messages: [] }, isLoading },
    handleSendMessage,
  ] = useAIConversation('chat');

  return (
    <AIConversation
      messages={messages}
      isLoading={isLoading}
      handleSendMessage={handleSendMessage}
    />
  );
}
