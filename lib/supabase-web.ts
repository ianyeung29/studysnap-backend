import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://xxwqpanfytavfvabhtbz.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4d3FwYW5meXRhdmZ2YWJodGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2Mzg4NzMsImV4cCI6MjA5OTIxNDg3M30.ZK6xHXELadLNOBfacwJBw7dEG7dozjWW-g5OQZMnHvg";

export const supabaseWeb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
  },
});
