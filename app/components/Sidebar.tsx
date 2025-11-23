'use client';

import { useConversations } from '@/app/context/ConversationsContext';
import { CreateChatButton } from './CreateChatButton';
import { ConversationItem } from './CreateConversation';
import { Loader } from '@aws-amplify/ui-react';

// Icon for closing the menu
const CloseIcon = () => (
  <svg
    className='w-6 h-6'
    fill='none'
    stroke='currentColor'
    viewBox='0 0 24 24'
    xmlns='http://www.w3.org/2000/svg'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth={2}
      d='M6 18L18 6M6 6l12 12'
    />
  </svg>
);

export default function Sidebar() {
  // Get all state and functions from our hook
  const { conversations, isLoading, isSidebarOpen, setIsSidebarOpen } =
    useConversations();

  return (
    <>
      {/* 1. Full-screen overlay (shown on mobile when menu is open) */}
      <div
        className={`fixed inset-0 z-40 bg-gray-900 bg-opacity-50 transition-opacity md:hidden ${
          isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* 2. 👇 FIX: Moved the className back inside the <aside> tag */}
      <aside
        className={`fixed top-0 left-0 z-50 w-64 bg-white h-screen border-r border-gray-200 p-4 flex flex-col transition-transform 
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:z-30 md:top-16 md:h-[calc(100vh-4rem)]`}
      >
        {/* Header with "New Chat" and "Close" button (for mobile) */}
        <div className='flex items-center justify-between pb-2 border-b'>
          <h2 className='font-semibold'>Conversations</h2>
          <CreateChatButton />
          <button
            className='md:hidden text-gray-500 hover:text-gray-800'
            onClick={() => setIsSidebarOpen(false)}
          >
            <CloseIcon />
          </button>
        </div>

        {/* List of Conversations */}
        <div className='flex-1 overflow-y-auto mt-4 space-y-2'>
          {isLoading ? (
            <div className='flex justify-center'>
              <Loader />
            </div>
          ) : (
            conversations.map((convo) => (
              <ConversationItem key={convo.id} conversation={convo} />
            ))
          )}
        </div>
      </aside>
    </>
  );
}
