'use client';
import { useConversations } from '@/app/context/ConversationsContext';

// Icon for "New Chat"
const PlusIcon = () => (
  <svg
    className='w-5 h-5'
    fill='none'
    stroke='currentColor'
    viewBox='0 0 24 24'
    xmlns='http://www.w3.org/2000/svg'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth={2}
      d='M12 4v16m8-8H4'
    />
  </svg>
);

export function CreateChatButton() {
  const { createConversation } = useConversations();
  return (
    <button
      onClick={() => createConversation()}
      className='p-1 text-gray-500 hover:text-blue-600'
      title='New Chat'
    >
      <PlusIcon />
    </button>
  );
}
