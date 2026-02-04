/**
 * MANUAL MODE TOGGLE COMPONENT
 * 
 * Allows users to enable/disable AI responses for a specific contact.
 * When manual mode is enabled, AI will not respond to incoming messages.
 * 
 * Usage:
 * <ManualModeToggle contactId="abc123" currentTags={["tag1", "tag2"]} />
 */

'use client';

import { useState } from 'react';

interface ManualModeToggleProps {
  contactId: string;
  currentTags: string[];
  onUpdate?: (newTags: string[]) => void;
}

export default function ManualModeToggle({ contactId, currentTags, onUpdate }: ManualModeToggleProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [tags, setTags] = useState(currentTags);
  
  const isManualMode = tags.some(tag => tag.toLowerCase().includes('manual'));

  const toggleManualMode = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/v1/toggle-manual-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contactId,
          enable: !isManualMode
        })
      });

      if (response.ok) {
        const result = await response.json();
        setTags(result.tags);
        onUpdate?.(result.tags);
        
        // Show success message
        alert(result.message);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Toggle manual mode error:', error);
      alert('Failed to toggle manual mode');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
      <div className="flex-1">
        <h4 className="font-medium text-gray-900">AI Response Mode</h4>
        <p className="text-sm text-gray-600">
          {isManualMode 
            ? '🚫 Manual mode - AI responses disabled' 
            : '🤖 Auto mode - AI will respond to messages'
          }
        </p>
      </div>
      
      <button
        onClick={toggleManualMode}
        disabled={isLoading}
        className={`px-4 py-2 rounded-md font-medium transition-colors ${
          isManualMode
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-red-600 hover:bg-red-700 text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isLoading ? 'Updating...' : (isManualMode ? 'Resume AI' : 'Take Over')}
      </button>
    </div>
  );
}
