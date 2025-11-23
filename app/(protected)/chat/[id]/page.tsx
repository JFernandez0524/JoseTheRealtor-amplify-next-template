'use client';
import { AIConversation, type SendMessage } from '@aws-amplify/ui-react-ai';
import { useAIConversation } from '@/app/utils/aws/data/frontEndClient';
import { useParams } from 'next/navigation';
import { useConversations } from '@/app/context/ConversationsContext'; // 1. Import context
import { Card, Text, Avatar } from '@aws-amplify/ui-react';
import { useUserProfile } from '@/app/hooks/useUserProfile';

export default function Page() {
  const params = useParams();
  const id = params.id as string;
  const attributes = useUserProfile();

  // 2. Get the rename function and conversations list
  const { conversations, renameConversation } = useConversations();

  // 3. Find the current conversation
  const currentConversation = conversations.find((c) => c.id === id);

  const [
    {
      data: { messages },
      isLoading,
    },
    handleSendMessage,
  ] = useAIConversation('chat', {
    id: id,
  });

  // 4. Create a wrapper for handleSendMessage
  const handleSendMessageWrapper: SendMessage = async (input) => {
    const contentString = input.content.find((c) => c.text)?.text;

    if (
      (!currentConversation?.name || currentConversation.name === 'New Chat') &&
      messages.length === 0 &&
      contentString // Ensure we found some text
    ) {
      // Create a short title from the first message
      const newName =
        contentString.substring(0, 40) +
        (contentString.length > 40 ? '...' : '');

      // Call our rename function
      await renameConversation(id, newName);
    }

    // 5. Call the original function, passing the *entire input object*
    handleSendMessage(input);
  };

  return (
    <div className='flex flex-col' style={{ height: 'calc(100vh - 4rem)' }}>
      <AIConversation
        welcomeMessage={
          <Card variation='outlined'>
            <Text>
              I am your virtual Real Estate assistant, ask me any questions you
              like!
            </Text>
          </Card>
        }
        avatars={{
          user: {
            avatar: <Avatar src={attributes?.picture || undefined} />,
            username: `${attributes?.name || 'User'}`,
          },
          // ai: {
          //   avatar: <Avatar src='/images/ai.jpg' />,
          //   username: 'Amplify assistant',
          // },
        }}
        messages={messages}
        isLoading={isLoading}
        // 5. Use our new wrapper function
        handleSendMessage={handleSendMessageWrapper}
      />
    </div>
  );
}
