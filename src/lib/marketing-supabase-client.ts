import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mkbfanmzhuxreztrafel.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rYmZhbm16aHV4cmV6dHJhZmVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTA4OTUsImV4cCI6MjA5MjY4Njg5NX0.qn2ygifWchBziK8Le8w-fuuZB3NL_t8FkUoPPA-4CM8';

/** Marketing hub — standard @supabase/supabase-js client (not SSR) */
export const marketingSupabase = createClient(supabaseUrl, supabaseAnonKey);
