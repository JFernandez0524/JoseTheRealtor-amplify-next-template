'use client';

import { useState, useEffect } from 'react';
import { client } from '@/src/lib/amplifyAIHooks';
import { useRouter } from 'next/navigation';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(
    typeof window !== 'undefined'
      ? (localStorage.getItem('conversationId') ?? null)
      : null
  );

  // Restore conversation on mount
  useEffect(() => {
    if (conversationId) {
      console.log('Restored conversation:', conversationId);
    }
  }, [conversationId]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    setIsLoading(true);

    // Optimistically add the user’s message
    setMessages((prev) => [...prev, { role: 'user', content: input }]);

    // 1. Create a conversation (if not already)
    const { data: chat } = await client.conversations.chat.create();
    const id = chat?.id;
    if (!id) {
      setIsLoading(false);
      return;
    }

    // Save conversation ID for reuse
    setConversationId(id);
    localStorage.setItem('conversationId', id);

    // 2. Subscribe to assistant responses
    const subscription = chat.onStreamEvent({
      next: (event) => {
        if (!('type' in event)) return;

        if (event.type === 'messageStart') {
          // Start new assistant message
          setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
        } else if (event.type === 'messageDelta') {
          // Append streamed text
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1].content += event.text ?? '';
            return updated;
          });
        } else if (event.type === 'messageStop') {
          console.log('✅ Message complete');
        }
      },
      error: (error) => {
        console.error('❌ AI Stream Error:', error);
      },
    });

    // 3. Send message
    try {
      await chat.sendMessage(input);
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='flex flex-col max-w-2xl mx-auto mt-8 p-4 border rounded-lg bg-white'>
      <div className='flex-1 overflow-y-auto space-y-3 mb-4'>
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-2 rounded-lg ${
              msg.role === 'user'
                ? 'bg-blue-100 text-right'
                : 'bg-gray-100 text-left'
            }`}
          >
            <strong>{msg.role === 'user' ? 'You: ' : 'AI: '}</strong>
            {msg.content}
          </div>
        ))}
      </div>

      <div className='flex gap-2'>
        <input
          type='text'
          className='flex-1 border rounded px-3 py-2'
          placeholder='Type your message...'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          disabled={isLoading}
        />
        <button
          onClick={handleSendMessage}
          disabled={isLoading}
          className='bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50'
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
