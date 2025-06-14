import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState } from '../types';
import { auth } from '../lib/supabase';

interface AuthStore extends AuthState {
  // Actions
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: true,

      // Actions
      signIn: async (email: string, password: string) => {
        set({ isLoading: true });
        
        try {
          const { data, error } = await auth.signIn(email, password);
          
          if (error) {
            set({ isLoading: false });
            return { success: false, error: error.message };
          }

          if (data.user) {
            // Fetch user profile from your users table
            const user: User = {
              id: data.user.id,
              email: data.user.email || '',
              name: data.user.user_metadata?.name || '',
              avatar: data.user.user_metadata?.avatar_url,
              role: data.user.user_metadata?.role || 'user',
              createdAt: data.user.created_at || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            set({
              user,
              isAuthenticated: true,
              isLoading: false,
            });

            return { success: true };
          }

          set({ isLoading: false });
          return { success: false, error: 'Authentication failed' };
        } catch (error) {
          set({ isLoading: false });
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error occurred' 
          };
        }
      },

      signUp: async (email: string, password: string, name: string) => {
        set({ isLoading: true });
        
        try {
          const { error } = await auth.signUp(email, password, { name });
          
          if (error) {
            set({ isLoading: false });
            return { success: false, error: error.message };
          }

          set({ isLoading: false });
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error occurred' 
          };
        }
      },

      signOut: async () => {
        set({ isLoading: true });
        
        try {
          await auth.signOut();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        } catch (error) {
          console.error('Error signing out:', error);
          set({ isLoading: false });
        }
      },

      setUser: (user: User | null) => {
        set({
          user,
          isAuthenticated: !!user,
        });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      initialize: async () => {
        try {
          const { user, error } = await auth.getUser();
          
          if (error || !user) {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
            return;
          }

          const userProfile: User = {
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.name || '',
            avatar: user.user_metadata?.avatar_url,
            role: user.user_metadata?.role || 'user',
            createdAt: user.created_at || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          set({
            user: userProfile,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          console.error('Error initializing auth:', error);
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
); 