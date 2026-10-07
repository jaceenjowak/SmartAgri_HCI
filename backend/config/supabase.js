const { createClient } = require('@supabase/supabase-js');

// This privileged client MUST stay in Express. Never bundle its secret into Vite/React.
const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret || url.includes('YOUR_PROJECT') || secret.includes('YOUR_BACKEND_ONLY')) {
  throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env (server only).');
}
if (secret.startsWith('sb_publishable_')) {
  throw new Error('A publishable key cannot be used for the server client. Use a secret key.');
}
module.exports = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
