// providers/ClerkProvider.tsx
import * as SecureStore from 'expo-secure-store';

type TokenCache = {
  getToken(key: string): Promise<string | null>;
  saveToken(key: string, value: string): Promise<void>;
};

export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      // Handle error or ignore
    }
  },
};