import { api } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { config } from './config';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  isAuthenticated: boolean;
}

export class AuthService {
  // Simple authentication using email (for users created with simplified registration)
  static async authenticateUser(email: string): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      console.log('🔍 [AuthService] Looking up user by email:', email);

      // Get all users and find by email
      const result = await api.getAllUsers();

      if (result.success && result.users) {
        const user = result.users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (user) {
          console.log('✅ [AuthService] User found:', user);

          // Give initial credits if user doesn't have any
          try {
            const API_BASE_URL = config.API_BASE_URL;
            await fetch(`${API_BASE_URL}/api/users/${user.id}/give-initial-credits`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            });
            console.log('✅ [AuthService] Initial credits check completed');
          } catch (creditError) {
            console.log('⚠️ [AuthService] Could not check/give initial credits:', creditError);
          }

          return {
            success: true,
            user: user
          };
        } else {
          console.log('❌ [AuthService] User not found for email:', email);
          return {
            success: false,
            error: 'User not found'
          };
        }
      } else {
        console.error('❌ [AuthService] Failed to fetch users:', result.error);
        return {
          success: false,
          error: result.error || 'Failed to fetch users'
        };
      }
    } catch (error) {
      console.error('💥 [AuthService] Authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  // Create a simple session for database users
  static createSession(user: any): UserSession {
    return {
      id: user.clerk_user_id,
      name: user.name,
      email: user.email,
      isAuthenticated: true
    };
  }

  // Store session in localStorage (for web) or AsyncStorage (for mobile)
  static async storeSession(session: UserSession): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Web environment
        localStorage.setItem('userSession', JSON.stringify(session));
        console.log('💾 [AuthService] Session stored in localStorage');
      } else {
        // Mobile environment - use AsyncStorage
        await AsyncStorage.setItem('userSession', JSON.stringify(session));
        console.log('💾 [AuthService] Session stored in AsyncStorage');
      }
    } catch (error) {
      console.error('❌ [AuthService] Failed to store session:', error);
    }
  }

  // Get stored session
  static async getStoredSession(): Promise<UserSession | null> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Web environment
        const session = localStorage.getItem('userSession');
        if (session) {
          const parsedSession = JSON.parse(session);
          console.log('📋 [AuthService] Retrieved session from localStorage:', parsedSession);
          return parsedSession;
        }
      } else {
        // Mobile environment - use AsyncStorage
        const session = await AsyncStorage.getItem('userSession');
        if (session) {
          const parsedSession = JSON.parse(session);
          console.log('📋 [AuthService] Retrieved session from AsyncStorage:', parsedSession);
          return parsedSession;
        }
      }
      return null;
    } catch (error) {
      console.error('❌ [AuthService] Failed to get stored session:', error);
      return null;
    }
  }

  // Clear stored session
  static async clearSession(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Web environment
        localStorage.removeItem('userSession');
        console.log('🗑️ [AuthService] Session cleared from localStorage');
      } else {
        // Mobile environment - use AsyncStorage
        await AsyncStorage.removeItem('userSession');
        console.log('🗑️ [AuthService] Session cleared from AsyncStorage');
      }

      // Also clear Supabase session
      await supabase.auth.signOut();
      console.log('🗑️ [AuthService] Supabase session cleared');
    } catch (error) {
      console.error('❌ [AuthService] Failed to clear session:', error);
    }
  }

  // ========= SUPABASE AUTHENTICATION METHODS =========

  // Register user with Supabase (integrated into existing flow)
  static async registerWithSupabase(email: string, password: string, name: string): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      console.log('🔍 [AuthService] Registering user with Supabase:', email);

      // Sign up with Supabase
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
        console.error('❌ [AuthService] Supabase signup error:', error);
        return { success: false, error: error.message };
      }

      if (data.user) {
        console.log('✅ [AuthService] Supabase user created:', data.user.id);

        // Create user in your database using the Supabase user ID
        const userData = {
          clerk_user_id: data.user.id, // Use Supabase user ID
          name: name,
          email: email,
          photo_url: data.user.user_metadata?.avatar_url || null,
          phone_number: data.user.phone || null,
        };

        const dbResult = await api.createUser(userData);
        if (dbResult.success) {
          console.log('✅ [AuthService] User created in database:', dbResult.user);
          return {
            success: true,
            user: dbResult.user
          };
        } else {
          console.error('❌ [AuthService] Failed to create user in database:', dbResult.error);
          return { success: false, error: 'Failed to create user in database' };
        }
      }

      return { success: false, error: 'User creation failed' };
    } catch (error: any) {
      console.error('💥 [AuthService] Unexpected error during Supabase registration:', error);
      return { success: false, error: error.message };
    }
  }

  // Authenticate with Supabase (integrated into existing flow)
  static async authenticateWithSupabase(email: string, password: string): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      console.log('🔍 [AuthService] Authenticating with Supabase:', email);

      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ [AuthService] Supabase signin error:', error);
        return { success: false, error: error.message };
      }

      if (data.user && data.session) {
        console.log('✅ [AuthService] Supabase authentication successful');

        // Find user in your database using Supabase user ID
        const existingUser = await api.getUserByClerkId(data.user.id);
        if (existingUser.success && existingUser.user) {
          console.log('✅ [AuthService] User found in database:', existingUser.user);

          // Give initial credits if user doesn't have any
          try {
            const API_BASE_URL = config.API_BASE_URL;
            await fetch(`${API_BASE_URL}/api/users/${existingUser.user.id}/give-initial-credits`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            });
            console.log('✅ [AuthService] Initial credits check completed');
          } catch (creditError) {
            console.log('⚠️ [AuthService] Could not check/give initial credits:', creditError);
          }

          return {
            success: true,
            user: existingUser.user
          };
        } else {
          // User not found in database, create them
          console.log('🆕 [AuthService] Creating user in database from Supabase user');
          const userData = {
            clerk_user_id: data.user.id,
            name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || email.split('@')[0],
            email: email,
            photo_url: data.user.user_metadata?.avatar_url || null,
            phone_number: data.user.phone || null,
          };

          const dbResult = await api.createUser(userData);
          if (dbResult.success) {
            console.log('✅ [AuthService] User created in database:', dbResult.user);
            return {
              success: true,
              user: dbResult.user
            };
          } else {
            console.error('❌ [AuthService] Failed to create user in database:', dbResult.error);
            return { success: false, error: 'Failed to create user in database' };
          }
        }
      }

      return { success: false, error: 'Authentication failed' };
    } catch (error: any) {
      console.error('💥 [AuthService] Unexpected error during Supabase authentication:', error);
      return { success: false, error: error.message };
    }
  }

  // Google OAuth with Supabase (integrated into existing flow)
  static async signInWithSupabaseGoogle(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔍 [AuthService] Starting Google OAuth with Supabase');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'exp://localhost:8081/--/oauth-callback',
        },
      });

      if (error) {
        console.error('❌ [AuthService] Supabase Google OAuth error:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ [AuthService] Google OAuth initiated successfully');
      return { success: true };
    } catch (error: any) {
      console.error('💥 [AuthService] Unexpected error during Google OAuth:', error);
      return { success: false, error: error.message };
    }
  }

  // Get current Supabase user and sync with database
  static async getCurrentSupabaseUser(): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        console.log('🔍 [AuthService] No current Supabase user found');
        return { success: false, error: 'No user found' };
      }

      console.log('✅ [AuthService] Current Supabase user found:', user.id);

      // Find user in your database
      const existingUser = await api.getUserByClerkId(user.id);
      if (existingUser.success && existingUser.user) {
        return {
          success: true,
          user: existingUser.user
        };
      } else {
        // User not in database, create them
        const userData = {
          clerk_user_id: user.id,
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email!.split('@')[0],
          email: user.email!,
          photo_url: user.user_metadata?.avatar_url || null,
          phone_number: user.phone || null,
        };

        const dbResult = await api.createUser(userData);
        if (dbResult.success) {
          return {
            success: true,
            user: dbResult.user
          };
        }
      }

      return { success: false, error: 'Failed to sync user with database' };
    } catch (error: any) {
      console.error('💥 [AuthService] Error getting current Supabase user:', error);
      return { success: false, error: error.message };
    }
  }

  // Reset password with Supabase
  static async resetPasswordWithSupabase(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔍 [AuthService] Sending password reset email via Supabase:', email);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'exp://localhost:8081/--/reset-password',
      });

      if (error) {
        console.error('❌ [AuthService] Supabase password reset error:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ [AuthService] Password reset email sent successfully');
      return { success: true };
    } catch (error: any) {
      console.error('💥 [AuthService] Unexpected error during password reset:', error);
      return { success: false, error: error.message };
    }
  }
}
