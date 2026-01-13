// app/components/leadDetails/CardWrapper.tsx

import React, { useState } from 'react';
import { FaPencilAlt } from 'react-icons/fa';

interface CardWrapperProps {
  title: string;
  children: React.ReactNode;
  initialEditing?: boolean;
  onEditToggle?: (isEditing: boolean) => void;
  isEditable?: boolean;
}

export function CardWrapper({
  title,
  children,
  initialEditing = false,
  onEditToggle,
  isEditable = false,
}: CardWrapperProps) {
  const [isEditing, setIsEditing] = useState(initialEditing);

  const toggleEdit = () => {
    const newState = !isEditing;
    setIsEditing(newState);
    if (onEditToggle) {
      onEditToggle(newState);
    }
  };

  return (
    <div className='bg-white shadow border rounded-lg p-6'>
      <div className='flex justify-between items-center mb-4'>
        <h2 className='text-xl font-semibold text-gray-800'>{title}</h2>
        {isEditable && (
          <button
            onClick={toggleEdit}
            className={`p-1 rounded-full transition ${
              isEditing
                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
            title={isEditing ? 'Exit Edit Mode' : 'Edit This Section'}
          >
            <FaPencilAlt className='h-5 w-5' />
          </button>
        )}
      </div>
      {/* FIX: Render children directly, relying on parent to pass props correctly. */}
      {children}
    </div>
  );
}
