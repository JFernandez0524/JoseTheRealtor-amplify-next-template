'use client';
import { AIConversation } from '@aws-amplify/ui-react-ai';
import { Card, Text, Avatar } from '@aws-amplify/ui-react';
import { useAIConversation } from '@/app/utils/aws/data/frontEndClient'; // Your custom hook
import { useUserProfile } from '@/app/hooks/useUserProfile';

export default function Page() {
  const attributes = useUserProfile();

  const [
    {
      data: { messages },
      isLoading,
    },
    handleSendMessage,
  ] = useAIConversation('chat');
  // 'chat' is based on the key for the conversation route in your schema.

  return (
    // 1. Create a wrapper div
    <div
      className='flex flex-col'
      // 2. Set the height to fill the remaining screen
      // 100vh (full screen) - 4rem (h-16, the height of your Navbar)
      style={{ height: 'calc(100vh - 4rem)' }}
    >
      {/* The AIConversation component will now be constrained 
        to the height of this parent div, and its internal 
        scrolling will work correctly, keeping the input in view.
      */}
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
        handleSendMessage={handleSendMessage}
      />
    </div>
  );
}
