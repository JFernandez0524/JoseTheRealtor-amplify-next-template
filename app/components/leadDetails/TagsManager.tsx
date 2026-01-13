'use client';

import { useState } from 'react';
import { client } from '@/app/utils/aws/data/frontEndClient';
import type { Schema } from '@/amplify/data/resource';

type Lead = Schema['PropertyLead']['type'];

interface Props {
  lead: Lead;
  onUpdate: (updatedLead: Lead) => void;
}

export function TagsManager({ lead, onUpdate }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const currentTags = lead.customTags || [];

  const addTag = async () => {
    if (!newTag.trim()) return;
    
    const updatedTags = [...currentTags, newTag.trim()];
    await updateTags(updatedTags);
    setNewTag('');
  };

  const removeTag = async (tagToRemove: string) => {
    const updatedTags = currentTags.filter(tag => tag !== tagToRemove);
    await updateTags(updatedTags);
  };

  const updateTags = async (tags: string[]) => {
    setIsLoading(true);
    try {
      const { data: updatedLead } = await client.models.PropertyLead.update({
        id: lead.id,
        customTags: tags
      });
      
      if (updatedLead) {
        onUpdate(updatedLead);
      }
    } catch (error) {
      console.error('Failed to update tags:', error);
      alert('Failed to update tags. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Custom Tags</h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          {isEditing ? 'Done' : 'Edit'}
        </button>
      </div>

      {/* Display Tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        {currentTags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
          >
            {tag}
            {isEditing && (
              <button
                onClick={() => removeTag(tag)}
                className="text-blue-600 hover:text-blue-800 ml-1"
                disabled={isLoading}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {currentTags.length === 0 && (
          <span className="text-gray-400 text-xs">No custom tags</span>
        )}
      </div>

      {/* Add New Tag */}
      {isEditing && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTag()}
            placeholder="Add new tag..."
            className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={isLoading}
          />
          <button
            onClick={addTag}
            disabled={!newTag.trim() || isLoading}
            className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
