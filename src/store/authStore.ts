import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile } from '../types';
import { supabase } from '../lib/supabase';

interface AuthState {
  profile: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthStore extends AuthState {
  // Actions
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      profile: null,
      isAuthenticated: false,
      isLoading: true,

      // Actions
      signIn: async (email: string, password: string) => {
        set({ isLoading: true });
        
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          
          if (error) {
            set({ isLoading: false });
            return { success: false, error: error.message };
          }

          if (data?.user) {
            // Fetch or create user profile
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();

            if (profileError && profileError.code === 'PGRST116') {
              // Profile doesn't exist, create it
              const newProfile = {
                id: data.user.id,
                email: data.user.email || '',
                full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || 'User',
                avatar_url: data.user.user_metadata?.avatar_url || null
              };

              const { data: createdProfile, error: createError } = await supabase
                .from('profiles')
                .insert(newProfile)
                .select()
                .single();

              if (createError) {
                set({ isLoading: false });
                return { success: false, error: 'Failed to create user profile' };
              }

              set({
                profile: createdProfile,
                isAuthenticated: true,
                isLoading: false,
              });
            } else if (profile) {
              set({
                profile,
                isAuthenticated: true,
                isLoading: false,
              });
            } else {
              set({ isLoading: false });
              return { success: false, error: 'Failed to fetch user profile' };
            }

            return { success: true };
          }

          set({ isLoading: false });
          return { success: false, error: 'Authentication failed' };
        } catch { // Ignored 
          set({ isLoading: false });
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error occurred' 
          };
        }
      },

      signUp: async (email: string, password: string, fullName: string) => {
        set({ isLoading: true });
        
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName
              }
            }
          });
          
          if (error) {
            set({ isLoading: false });
            return { success: false, error: error.message };
          }

          if (data?.user) {
            // Profile will be created via database trigger or auth hook
            set({ isLoading: false });
            return { success: true };
          }

          set({ isLoading: false });
          return { success: false, error: 'Sign up failed' };
        } catch { // Ignored 
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
          await supabase.auth.signOut();
          set({
            profile: null,
            isAuthenticated: false,
            isLoading: false,
          });
        } catch { // Ignored 
          console.error('Error signing out:', error);
          set({ isLoading: false });
        }
      },

      setProfile: (profile: Profile | null) => {
        set({
          profile,
          isAuthenticated: !!profile,
        });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      updateProfile: async (updates: Partial<Profile>) => {
        const { profile } = get();
        if (!profile) {
          return { success: false, error: 'No profile found' };
        }

        try {
          const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', profile.id)
            .select()
            .single();

          if (error) {
            return { success: false, error: error.message };
          }

          set({ profile: data });
          return { success: true };
        } catch { // Ignored 
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Update failed'
          };
        }
      },

      refreshProfile: async () => {
        const { profile } = get();
        if (!profile) return;

        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', profile.id)
            .single();

          if (error) {
            console.error('Error refreshing profile:', error);
            return;
          }

          set({ profile: data });
        } catch { // Ignored 
          console.error('Error refreshing profile:', error);
        }
      },

      initialize: async () => {
        try {
          const { data: { user }, error } = await supabase.auth.getUser();
          
          if (error || !user) {
            set({
              profile: null,
              isAuthenticated: false,
              isLoading: false,
            });
            return;
          }

          // Fetch user profile
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profileError) {
            console.error('Error fetching profile:', profileError);
            set({
              profile: null,
              isAuthenticated: false,
              isLoading: false,
            });
            return;
          }

          set({
            profile,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch { // Ignored 
          console.error('Error initializing auth:', error);
          set({
            profile: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: 'wacanda-auth-storage',
      partialize: (state) => ({
        profile: state.profile,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Set up auth state change listener
supabase.auth.onAuthStateChange((event, session) => {
  const { initialize } = useAuthStore.getState();
  
  if (event === 'SIGNED_OUT') {
    useAuthStore.setState({
      profile: null,
      isAuthenticated: false,
      isLoading: false,
    });
  } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    initialize();
  }
});