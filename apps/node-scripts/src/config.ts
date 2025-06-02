import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

export const loadConfig = () => {
  config();

  const SUPABASE_URL = process.env['SUPABASE_URL'];
  const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_KEY'];

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  return {
    supabase,
    pageSize: 100,
  };
};
