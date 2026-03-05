import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { apiClient } from '../api/client';

interface Post {
  id: string;
  text: string;
  publishedAt: string;
  includeInAI: boolean;
  attachments: any[];
  reactions: any[];
  replies: any[];
  resumeTags: any[];
  createdAt: string;
  updatedAt: string;
}

interface AIContextContextType {
  posts: Post[];
  isLoading: boolean;
  error: string | null;
  fetchPosts: (search?: string, includeInAI?: boolean, resumeId?: string) => Promise<void>;
  createPost: (text: string, publishedAt?: Date, includeInAI?: boolean) => Promise<Post>;
  updatePost: (postId: string, text?: string, publishedAt?: Date, includeInAI?: boolean) => Promise<Post>;
  deletePost: (postId: string) => Promise<void>;
  addReaction: (postId: string, reactionType: string, customEmoji?: string) => Promise<void>;
  removeReaction: (postId: string, reactionType: string, customEmoji?: string) => Promise<void>;
  addReply: (postId: string, text: string) => Promise<void>;
  getAIContext: (resumeId?: string) => Promise<string>;
}

const AIContextContext = createContext<AIContextContextType | undefined>(undefined);

export function AIContextProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async (search?: string, includeInAI?: boolean, resumeId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const posts = await apiClient.getAIContextPosts(search, includeInAI, resumeId);
      setPosts(posts);
    } catch (err: any) {
      setError(err.message || 'Failed to load posts');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createPost = useCallback(
    async (text: string, publishedAt?: Date, includeInAI?: boolean): Promise<Post> => {
      try {
        const post = await apiClient.createAIContextPost(
          text,
          publishedAt?.toISOString(),
          includeInAI ?? true
        );
        setPosts([post, ...posts]);
        return post;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to create post';
        setError(errorMsg);
        throw err;
      }
    },
    [posts]
  );

  const updatePost = useCallback(
    async (postId: string, text?: string, publishedAt?: Date, includeInAI?: boolean): Promise<Post> => {
      try {
        const post = await apiClient.updateAIContextPost(
          postId,
          text,
          publishedAt?.toISOString(),
          includeInAI
        );
        setPosts(posts.map(p => (p.id === postId ? post : p)));
        return post;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to update post';
        setError(errorMsg);
        throw err;
      }
    },
    [posts]
  );

  const deletePost = useCallback(
    async (postId: string) => {
      try {
        await apiClient.deleteAIContextPost(postId);
        setPosts(posts.filter(p => p.id !== postId));
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to delete post';
        setError(errorMsg);
        throw err;
      }
    },
    [posts]
  );

  const addReaction = useCallback(async (postId: string, reactionType: string, customEmoji?: string) => {
    try {
      await apiClient.addAIContextReaction(postId, reactionType, customEmoji);
      // Refresh reactions by refetching the post
      await fetchPosts();
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to add reaction';
      setError(errorMsg);
      throw err;
    }
  }, [fetchPosts]);

  const removeReaction = useCallback(async (postId: string, reactionType: string, customEmoji?: string) => {
    try {
      await apiClient.removeAIContextReaction(postId, reactionType, customEmoji);
      // Refresh reactions by refetching the post
      await fetchPosts();
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to remove reaction';
      setError(errorMsg);
      throw err;
    }
  }, [fetchPosts]);

  const addReply = useCallback(async (postId: string, text: string) => {
    try {
      await apiClient.addAIContextReply(postId, text);
      // Refresh the post
      await fetchPosts();
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to add reply';
      setError(errorMsg);
      throw err;
    }
  }, [fetchPosts]);

  const getAIContext = useCallback(async (resumeId?: string): Promise<string> => {
    try {
      return await apiClient.getAIContextString(resumeId);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to get AI context';
      setError(errorMsg);
      throw err;
    }
  }, []);

  return (
    <AIContextContext.Provider
      value={{
        posts,
        isLoading,
        error,
        fetchPosts,
        createPost,
        updatePost,
        deletePost,
        addReaction,
        removeReaction,
        addReply,
        getAIContext,
      }}
    >
      {children}
    </AIContextContext.Provider>
  );
}

export function useAIContext() {
  const context = useContext(AIContextContext);
  if (!context) {
    throw new Error('useAIContext must be used within an AIContextProvider');
  }
  return context;
}
