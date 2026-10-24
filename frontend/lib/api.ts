import axios from 'axios';
import config from './config';

const API_BASE_URL = config.API_BASE_URL;

export interface CreateUserData {
  clerk_user_id: string;
  name: string;
  email: string;
  photo_url?: string | null;
  phone_number?: string | null;
}

export interface User {
  id: string;
  clerk_user_id: string;
  name: string;
  email: string;
  photo_url?: string | null;
  phone_number?: string | null;
  created_at: string;
  updated_at?: string;
}

export const api = {
  // Create a new user in the database
  createUser: async (userData: CreateUserData): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/users`, userData);
      return response.data;
    } catch (error: any) {
      console.error('Error creating user:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to create user'
      };
    }
  },

  // Get user by clerk_user_id
  getUserByClerkId: async (clerkUserId: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/users?clerk_user_id=${clerkUserId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching user:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to fetch user'
      };
    }
  },

  // Get all users
  getAllUsers: async (): Promise<{ success: boolean; users?: User[]; error?: string }> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/users`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching users:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to fetch users'
      };
    }
  }
}; 