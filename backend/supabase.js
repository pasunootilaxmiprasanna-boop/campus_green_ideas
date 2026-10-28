const { createClient } = require('@supabase/supabase-js');

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}
const url = process.env.SUPABASE_URL;
const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };

// Server-only privileged client: never expose this key to the browser.
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
// Public-key client is used only for Supabase Auth sign-up/sign-in calls.
const authClient = createClient(url, process.env.SUPABASE_ANON_KEY, options);
module.exports = { db, authClient };