import { ExecutaApiClient } from '@executa/api-client';
import { supabase } from './supabase';

export const api = new ExecutaApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  getAccessToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }
});
