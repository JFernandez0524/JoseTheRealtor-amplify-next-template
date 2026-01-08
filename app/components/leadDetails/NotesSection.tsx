// app/components/leadDetails/NotesSection.tsx

import { useState, useEffect } from 'react';
import { fetchUserAttributes } from 'aws-amplify/auth';

interface Note {
  text: string;
  createdAt: string;
  createdBy?: string;
}

interface NotesSectionProps {
  notes: Note[] | null;
  onNotesUpdate: (notes: Note[]) => void;
  isEditing: boolean;
}

export function NotesSection({ notes, onNotesUpdate, isEditing }: NotesSectionProps) {
  const [newNoteText, setNewNoteText] = useState('');
  const [currentUser, setCurrentUser] = useState<string>('User');

  // Get current user info
  useEffect(() => {
    async function loadUser() {
      try {
        const attributes = await fetchUserAttributes();
        if (attributes.email) {
          // Use email prefix as display name (e.g., "john@example.com" -> "john")
          const displayName = attributes.email.split('@')[0];
          setCurrentUser(displayName);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    }
    loadUser();
  }, []);

  // Handle legacy string format and ensure we have an array
  const notesArray = Array.isArray(notes) ? notes : [];

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;

    const newNote: Note = {
      text: newNoteText.trim(),
      createdAt: new Date().toISOString(),
      createdBy: currentUser
    };

    const updatedNotes = [...notesArray, newNote];
    onNotesUpdate(updatedNotes);
    setNewNoteText('');
  };

  const handleDeleteNote = (index: number) => {
    const updatedNotes = notesArray.filter((_, i) => i !== index);
    onNotesUpdate(updatedNotes);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No date';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'No date';
      }
      return date.toLocaleDateString();
    } catch (error) {
      return 'No date';
    }
  };

  return (
    <div className='space-y-4'>
      <label className='block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2'>
        Notes
      </label>

      {/* Existing Notes */}
      <div className='space-y-3 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3 bg-gray-50'>
        {notesArray.map((note, index) => (
          <div key={index} className='bg-white p-3 rounded-md border shadow-sm'>
            <div className='flex justify-between items-start mb-2'>
              <span className='text-xs text-gray-500'>
                {formatDate(note.createdAt)}
                {note.createdBy && ` • ${note.createdBy}`}
              </span>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => handleDeleteNote(index)}
                  className='text-red-500 hover:text-red-700 text-xs'
                >
                  Delete
                </button>
              )}
            </div>
            <p className='text-sm text-gray-800 whitespace-pre-wrap'>{note.text}</p>
          </div>
        ))}
        
        {notesArray.length === 0 && (
          <p className='text-gray-400 italic text-sm text-center py-4'>No notes yet</p>
        )}
      </div>

      {/* Add New Note */}
      {isEditing && (
        <div className='space-y-2'>
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Add a new note..."
            className='w-full border border-gray-200 rounded-md p-2 text-sm text-gray-800 focus:ring-indigo-500'
            rows={3}
          />
          <button
            type="button"
            onClick={handleAddNote}
            disabled={!newNoteText.trim()}
            className='px-3 py-1 bg-blue-500 text-white text-sm rounded disabled:bg-gray-300'
          >
            Add Note
          </button>
        </div>
      )}
    </div>
  );
}
