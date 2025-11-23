'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useConversations } from '@/app/context/ConversationsContext';
import { type Schema } from '@/amplify/data/resource';
import { useState } from 'react';

type Conversation = Schema['chat']['type'];

// Icon for "Delete"
const DeleteIcon = () => (
  <svg
    className='w-4 h-4'
    fill='none'
    stroke='currentColor'
    viewBox='0 0 24 24'
    xmlns='http://www.w3.org/2000/svg'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth={2}
      d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
    />
  </svg>
);

const EditIcon = () => (
  <svg
    className='w-4 h-4'
    fill='none'
    stroke='currentColor'
    viewBox='0 0 24 24'
    xmlns='http://www.w3.org/2000/svg'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth={2}
      d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z'
    />
  </svg>
);

export function ConversationItem({
  conversation,
}: {
  conversation: Conversation;
}) {
  const { deleteConversation, renameConversation, setIsSidebarOpen } =
    useConversations();
  const params = useParams();
  const isActive = params.id === conversation.id;
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(conversation.name || 'New Chat');

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Stop click from navigating
    e.preventDefault();
    if (window.confirm('Are you sure you want to delete this chat?')) {
      deleteConversation(conversation.id);
    }
  };

  const handleRename = () => {
    if (name !== (conversation.name || 'New Chat')) {
      renameConversation(conversation.id, name);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setName(conversation.name || 'New Chat'); // Revert
    }
  };

  // 4. Render either the Link or the Input
  return (
    <div
      className={`group flex items-center justify-between p-2 rounded-md text-sm font-medium
        ${
          isActive
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100'
        }
      `}
    >
      {isEditing ? (
        <input
          type='text'
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleRename}
          onKeyDown={handleKeyDown}
          className='flex-1 bg-white border border-blue-300 rounded p-0.5 -m-0.5'
          autoFocus
        />
      ) : (
        <Link
          href={`/chat/${conversation.id}`}
          onClick={() => setIsSidebarOpen(false)}
          className='flex-1 truncate'
        >
          {conversation.name || 'New Chat'}
        </Link>
      )}

      {/* 5. Show Edit/Delete buttons */}
      <div className='flex'>
        {isEditing ? (
          <button
            onClick={handleRename}
            className='p-1 rounded text-gray-500 hover:text-green-600'
            title='Save'
          >
            {/* Simple Checkmark icon */}
            <svg
              className='w-4 h-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M5 13l4 4L19 7'
              />
            </svg>
          </button>
        ) : (
          <>
            <button
              onClick={() => setIsEditing(true)}
              className={`p-1 rounded text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 ${
                isActive && 'opacity-100'
              }`}
              title='Rename chat'
            >
              <EditIcon />
            </button>
            <button
              onClick={handleDelete}
              className={`p-1 rounded text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 ${
                isActive && 'opacity-100'
              }`}
              title='Delete chat'
            >
              <DeleteIcon />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
