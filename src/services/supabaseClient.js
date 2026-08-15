import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY;

export const isSupabaseConfigured = Boolean(url && key && url !== 'https://your-project-ref.supabase.co');

export const supabase = isSupabaseConfigured
  ? createClient(url, key)
  : null;
