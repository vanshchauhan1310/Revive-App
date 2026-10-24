import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = "https://bzqqeativrabfbcqlzzl.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cXFlYXRpdnJhYmZiY3FsenpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDY1NDc4OSwiZXhwIjoyMDY2MjMwNzg5fQ.Jdr_lvPNntZW0j6Xpgjnig-YaC1t_ukiZQ4gGM2kM_E";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export class UserService {
  // Create a new user in the database
  static async createUser(userData) {
    try {
      console.log('🗄️ [Backend] Starting user creation in database...');
      console.log('📊 [Backend] User data received:', {
        clerk_user_id: userData.clerk_user_id,
        name: userData.name,
        email: userData.email,
        has_photo: !!userData.photo_url,
        has_phone: !!userData.phone_number
      });

      // Validate required fields
      if (!userData.clerk_user_id || !userData.name || !userData.email) {
        console.error('❌ [Backend] Missing required fields:', {
          has_clerk_id: !!userData.clerk_user_id,
          has_name: !!userData.name,
          has_email: !!userData.email
        });
        return {
          success: false,
          error: "Missing required fields: clerk_user_id, name, email"
        };
      }

      console.log('✅ [Backend] Validation passed, inserting into database...');

      // Insert user into Supabase users table
      const { data, error } = await supabase
        .from('users')
        .insert({
          clerk_user_id: userData.clerk_user_id,
          name: userData.name,
          email: userData.email,
          photo_url: userData.photo_url || null,
          phone_number: userData.phone_number || null,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [Backend] Supabase error:', error);
        console.error('❌ [Backend] Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return {
          success: false,
          error: error.message
        };
      }

      console.log('✅ [Backend] User created successfully in database');
      console.log('📋 [Backend] Created user details:', {
        id: data.id,
        clerk_user_id: data.clerk_user_id,
        name: data.name,
        email: data.email,
        created_at: data.created_at
      });

      return {
        success: true,
        user: data
      };
    } catch (error) {
      console.error('💥 [Backend] Server error during user creation:', error);
      console.error('💥 [Backend] Error stack:', error.stack);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get user by clerk_user_id
  static async getUserByClerkId(clerkUserId) {
    try {
      console.log('🔍 [Backend] Looking up user by Clerk ID:', clerkUserId);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('clerk_user_id', clerkUserId)
        .single();
      
      if (error || !data) {
        console.log('❌ [Backend] User not found for Clerk ID:', clerkUserId);
        return {
          success: false,
          error: "User not found"
        };
      }
      
      console.log('✅ [Backend] User found:', {
        id: data.id,
        name: data.name,
        email: data.email
      });
      
      return {
        success: true,
        user: data
      };
    } catch (error) {
      console.error('💥 [Backend] Error looking up user:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get all users
  static async getAllUsers() {
    try {
      console.log('📋 [Backend] Fetching all users...');
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ [Backend] Error fetching all users:', error);
        return {
          success: false,
          error: error.message
        };
      }
      
      console.log('✅ [Backend] Successfully fetched', data.length, 'users');
      
      return {
        success: true,
        users: data
      };
    } catch (error) {
      console.error('💥 [Backend] Error fetching all users:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Update user
  static async updateUser(clerkUserId, updateData) {
    try {
      console.log('🔄 [Backend] Updating user:', clerkUserId);
      console.log('📝 [Backend] Update data:', updateData);
      
      const { data, error } = await supabase
        .from('users')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('clerk_user_id', clerkUserId)
        .select()
        .single();

      if (error) {
        console.error('❌ [Backend] Error updating user:', error);
        return {
          success: false,
          error: error.message
        };
      }

      console.log('✅ [Backend] User updated successfully');
      return {
        success: true,
        user: data
      };
    } catch (error) {
      console.error('💥 [Backend] Error updating user:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Delete user
  static async deleteUser(clerkUserId) {
    try {
      console.log('🗑️ [Backend] Deleting user:', clerkUserId);
      
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('clerk_user_id', clerkUserId);

      if (error) {
        console.error('❌ [Backend] Error deleting user:', error);
        return {
          success: false,
          error: error.message
        };
      }

      console.log('✅ [Backend] User deleted successfully');
      return {
        success: true
      };
    } catch (error) {
      console.error('💥 [Backend] Error deleting user:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Express route handlers
export const setupUserRoutes = (app) => {
  // POST /api/users - Create user
  app.post('/api/users', async (req, res) => {
    try {
      console.log('📨 [API] POST /api/users - Create user request received');
      console.log('📊 [API] Request body:', req.body);
      
      const result = await UserService.createUser(req.body);
      
      if (result.success) {
        console.log('✅ [API] User creation successful, sending response');
        return res.status(200).json({ 
          success: true, 
          message: "User created successfully",
          user: result.user
        });
      } else {
        console.error('❌ [API] User creation failed:', result.error);
        return res.status(400).json({ 
          success: false, 
          error: result.error 
        });
      }
    } catch (error) {
      console.error('💥 [API] Unexpected error in POST /api/users:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // GET /api/users - Get all users or specific user
  app.get('/api/users', async (req, res) => {
    try {
      console.log('📨 [API] GET /api/users - Get users request received');
      console.log('🔍 [API] Query params:', req.query);
      
      const clerkUserId = req.query.clerk_user_id;
      
      if (clerkUserId) {
        console.log('🔍 [API] Looking up specific user:', clerkUserId);
        // Get specific user by clerk_user_id
        const result = await UserService.getUserByClerkId(clerkUserId);
        
        if (result.success) {
          console.log('✅ [API] User found, sending response');
          return res.status(200).json({ 
            success: true, 
            user: result.user
          });
        } else {
          console.log('❌ [API] User not found');
          return res.status(404).json({ 
            success: false, 
            error: result.error 
          });
        }
      } else {
        console.log('📋 [API] Fetching all users');
        // Get all users
        const result = await UserService.getAllUsers();
        
        if (result.success) {
          console.log('✅ [API] All users fetched, sending response');
          return res.status(200).json({ 
            success: true, 
            users: result.users
          });
        } else {
          console.error('❌ [API] Error fetching all users:', result.error);
          return res.status(400).json({ 
            success: false, 
            error: result.error 
          });
        }
      }
    } catch (error) {
      console.error('💥 [API] Unexpected error in GET /api/users:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // PUT /api/users - Update user
  app.put('/api/users', async (req, res) => {
    try {
      console.log('📨 [API] PUT /api/users - Update user request received');
      console.log('📊 [API] Request body:', req.body);
      console.log('🔍 [API] Query params:', req.query);
      
      const clerkUserId = req.query.clerk_user_id;
      
      if (!clerkUserId) {
        console.error('❌ [API] Missing clerk_user_id parameter');
        return res.status(400).json({ 
          success: false, 
          error: "Missing clerk_user_id parameter" 
        });
      }

      const result = await UserService.updateUser(clerkUserId, req.body);
      
      if (result.success) {
        console.log('✅ [API] User updated successfully');
        return res.status(200).json({ 
          success: true, 
          message: "User updated successfully",
          user: result.user
        });
      } else {
        console.error('❌ [API] User update failed:', result.error);
        return res.status(400).json({ 
          success: false, 
          error: result.error 
        });
      }
    } catch (error) {
      console.error('💥 [API] Unexpected error in PUT /api/users:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // DELETE /api/users - Delete user
  app.delete('/api/users', async (req, res) => {
    try {
      console.log('📨 [API] DELETE /api/users - Delete user request received');
      console.log('🔍 [API] Query params:', req.query);
      
      const clerkUserId = req.query.clerk_user_id;

      if (!clerkUserId) {
        console.error('❌ [API] Missing clerk_user_id parameter');
        return res.status(400).json({ 
          success: false, 
          error: "Missing clerk_user_id parameter" 
        });
      }

      const result = await UserService.deleteUser(clerkUserId);
      
      if (result.success) {
        console.log('✅ [API] User deleted successfully');
        return res.status(200).json({ 
          success: true, 
          message: "User deleted successfully"
        });
      } else {
        console.error('❌ [API] User deletion failed:', result.error);
        return res.status(400).json({ 
          success: false, 
          error: result.error 
        });
      }
    } catch (error) {
      console.error('💥 [API] Unexpected error in DELETE /api/users:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
}; 