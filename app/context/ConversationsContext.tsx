'use client';

import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { client } from '@/app/utils/aws/data/frontEndClient'; // Your client file
import { type Schema } from '@/amplify/data/resource';
import { useRouter } from 'next/navigation';

// Define the shape of a single conversation in the list
type Conversation = Schema['chat']['type'];

// Define what the context will provide
interface ConversationsContextType {
  conversations: Conversation[];
  isLoading: boolean;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  createConversation: () => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, newName: string) => Promise<void>;
}

// Create the context
const ConversationsContext = createContext<
  ConversationsContextType | undefined
>(undefined);

// Create the Provider component
export function ConversationsProvider({ children }: { children: ReactNode }) {
  const { authStatus } = useAuthenticator();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Fetch the list of conversations when the user is logged in
  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchConversations();
    }
  }, [authStatus]);

  async function fetchConversations() {
    setIsLoading(true);
    try {
      // Fetches all conversations, sorted by most recent [cite: 1]
      const { data: convos } = await client.conversations.chat.list();
      setConversations(convos || []);
    } catch (e) {
      console.error('Failed to fetch conversations', e);
    } finally {
      setIsLoading(false);
    }
  }

  // Function to create a new, blank conversation
  async function createConversation() {
    try {
      // Create the conversation [cite: 1]
      const { data: newConvo } = await client.conversations.chat.create();
      if (newConvo) {
        // Add the new chat to the top of our list
        setConversations((prev) => [newConvo, ...prev]);
        // Close the sidebar
        setIsSidebarOpen(false);
        // Navigate to the new chat page
        router.push(`/chat/${newConvo.id}`);
      }
    } catch (e) {
      console.error('Failed to create conversation', e);
    }
  }

  // Function to delete a conversation
  async function deleteConversation(id: string) {
    try {
      // Delete from the backend [cite: 1]
      await client.conversations.chat.delete({ id });
      // Remove it from our local list
      setConversations((prev) => prev.filter((convo) => convo.id !== id));
    } catch (e) {
      console.error('Failed to delete conversation', e);
    }
  }

  async function renameConversation(id: string, newName: string) {
    if (!newName.trim()) return; // Don't save empty names

    // Optimistic update: Update local state immediately
    setConversations((prev) =>
      prev.map((convo) =>
        convo.id === id ? { ...convo, name: newName } : convo
      )
    );

    // Call the backend
    try {
      await client.conversations.chat.update({ id, name: newName });
    } catch (e) {
      console.error('Failed to rename conversation', e);
      // Rollback on error (optional)
      fetchConversations();
    }
  }

  const value = {
    conversations,
    isLoading,
    isSidebarOpen,
    setIsSidebarOpen,
    createConversation,
    deleteConversation,
    renameConversation,
  };

  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
}

// Create the custom hook
export function useConversations() {
  const context = useContext(ConversationsContext);
  if (context === undefined) {
    throw new Error(
      'useConversations must be used within a ConversationsProvider'
    );
  }
  return context;
}
