import { supabase } from './supabase';
import { api } from './api';

export interface SupabaseAuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  phone?: string;
}

export interface AuthResult {
  success: boolean;
  user?: SupabaseAuthUser;
  error?: string;
}

export class SupabaseAuthService {
  // Sign up with email and password
  static async signUp(email: string, password: string, name: string): Promise<AuthResult> {
    try {
      console.log('[SupabaseAuth] Starting sign up with email:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            name: name,
          },
        },
      });

      if (error) {
        console.error('[SupabaseAuth] Sign up error:', error);
        return { success: false, error: error.message };
      }

      if (data.user && data.session) {
        console.log('[SupabaseAuth] Sign up successful, creating user in database');
        
        // Create user in your database
        const userData = {
          clerk_user_id: data.user.id, // Using Supabase user ID as the identifier
          name: name,
          email: email,
          photo_url: data.user.user_metadata?.avatar_url || null,
          phone_number: data.user.phone || null,
        };

        const dbResult = await api.createUser(userData);
        if (dbResult.success) {
          console.log('[SupabaseAuth] User created in database:', dbResult.user);
        }

        return {
          success: true,
          user: {
            id: data.user.id,
            email: data.user.email!,
            name: name,
            avatar_url: data.user.user_metadata?.avatar_url,
            phone: data.user.phone,
          },
        };
      }

      return { success: false, error: 'User creation failed' };
    } catch (error: any) {
      console.error('[SupabaseAuth] Unexpected error during sign up:', error);
      return { success: false, error: error.message };
    }
  }

  // Sign in with email and password
  static async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      console.log('[SupabaseAuth] Starting sign in with email:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[SupabaseAuth] Sign in error:', error);
        return { success: false, error: error.message };
      }

      if (data.user && data.session) {
        console.log('[SupabaseAuth] Sign in successful');
        
        // Ensure user exists in your database
        const existingUser = await api.getUserByClerkId(data.user.id);
        if (!existingUser.success) {
          // User doesn't exist in database, create them
          const userData = {
            clerk_user_id: data.user.id,
            name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || email.split('@')[0],
            email: email,
            photo_url: data.user.user_metadata?.avatar_url || null,
            phone_number: data.user.phone || null,
          };

          const dbResult = await api.createUser(userData);
          if (dbResult.success) {
            console.log('[SupabaseAuth] User created in database:', dbResult.user);
          }
        }

        return {
          success: true,
          user: {
            id: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || email.split('@')[0],
            avatar_url: data.user.user_metadata?.avatar_url,
            phone: data.user.phone,
          },
        };
      }

      return { success: false, error: 'Sign in failed' };
    } catch (error: any) {
      console.error('[SupabaseAuth] Unexpected error during sign in:', error);
      return { success: false, error: error.message };
    }
  }

  // Sign in with Google OAuth
  static async signInWithGoogle(): Promise<AuthResult> {
    try {
      console.log('[SupabaseAuth] Starting Google OAuth sign in');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'exp://localhost:8081/--/oauth-callback',
        },
      });

      if (error) {
        console.error('[SupabaseAuth] Google OAuth error:', error);
        return { success: false, error: error.message };
      }

      // Note: For OAuth, the actual user data will be available after redirect
      // This method initiates the OAuth flow
      console.log('[SupabaseAuth] Google OAuth initiated successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[SupabaseAuth] Unexpected error during Google sign in:', error);
      return { success: false, error: error.message };
    }
  }

  // Get current user
  static async getCurrentUser(): Promise<SupabaseAuthUser | null> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        console.log('[SupabaseAuth] No current user found');
        return null;
      }

      return {
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email!.split('@')[0],
        avatar_url: user.user_metadata?.avatar_url,
        phone: user.phone,
      };
    } catch (error) {
      console.error('[SupabaseAuth] Error getting current user:', error);
      return null;
    }
  }

  // Sign out
  static async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[SupabaseAuth] Signing out');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('[SupabaseAuth] Sign out error:', error);
        return { success: false, error: error.message };
      }

      console.log('[SupabaseAuth] Sign out successful');
      return { success: true };
    } catch (error: any) {
      console.error('[SupabaseAuth] Unexpected error during sign out:', error);
      return { success: false, error: error.message };
    }
  }

  // Reset password
  static async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[SupabaseAuth] Sending password reset email to:', email);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'exp://localhost:8081/--/reset-password',
      });

      if (error) {
        console.error('[SupabaseAuth] Password reset error:', error);
        return { success: false, error: error.message };
      }

      console.log('[SupabaseAuth] Password reset email sent successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[SupabaseAuth] Unexpected error during password reset:', error);
      return { success: false, error: error.message };
    }
  }

  // Update password
  static async updatePassword(password: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[SupabaseAuth] Updating password');
      
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        console.error('[SupabaseAuth] Password update error:', error);
        return { success: false, error: error.message };
      }

      console.log('[SupabaseAuth] Password updated successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[SupabaseAuth] Unexpected error during password update:', error);
      return { success: false, error: error.message };
    }
  }

  // Update profile
  static async updateProfile(updates: { name?: string; avatar_url?: string }): Promise<AuthResult> {
    try {
      console.log('[SupabaseAuth] Updating user profile:', updates);
      
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: updates.name,
          name: updates.name,
          avatar_url: updates.avatar_url,
        },
      });

      if (error) {
        console.error('[SupabaseAuth] Profile update error:', error);
        return { success: false, error: error.message };
      }

      if (data.user) {
        console.log('[SupabaseAuth] Profile updated successfully');
        
        return {
          success: true,
          user: {
            id: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email!.split('@')[0],
            avatar_url: data.user.user_metadata?.avatar_url,
            phone: data.user.phone,
          },
        };
      }

      return { success: false, error: 'Profile update failed' };
    } catch (error: any) {
      console.error('[SupabaseAuth] Unexpected error during profile update:', error);
      return { success: false, error: error.message };
    }
  }

  // Check if user is authenticated
  static async isAuthenticated(): Promise<boolean> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      return !error && !!session;
    } catch (error) {
      console.error('[SupabaseAuth] Error checking authentication status:', error);
      return false;
    }
  }

  // Listen to auth changes
  static onAuthStateChange(callback: (user: SupabaseAuthUser | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[SupabaseAuth] Auth state changed:', { event, session });
      
      if (session?.user) {
        const user: SupabaseAuthUser = {
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email!.split('@')[0],
          avatar_url: session.user.user_metadata?.avatar_url,
          phone: session.user.phone,
        };
        callback(user);
      } else {
        callback(null);
      }
    });
  }
}
