/* =====================================================================
   CONFIG.JS  -  your Supabase Project URL and publishable key.

   Step 2 on the worksheet fills this in: your agent does it for you, or
   asks you to paste the two values. Until then the game runs in practice
   mode (tabs on this computer only).

   Where the values come from (Supabase dashboard, your game project):
   - Project URL: your browser's address bar shows
     supabase.com/dashboard/project/abcdefghijklm
     so the Project URL is https://abcdefghijklm.supabase.co
   - Publishable key: gear icon (Project Settings) > API Keys, the key
     that starts with sb_publishable_ (the legacy "anon" key also works).

   NEVER the secret key (sb_secret_...) or the service_role key. Those
   unlock your whole project. The engine refuses them.

   The publishable key is meant to be public, so it's fine that this file
   goes online. This game uses no database tables, only live messages.
   ===================================================================== */

window.GAME_CONFIG = {
  SUPABASE_URL: "PASTE_YOUR_PROJECT_URL_HERE",
  SUPABASE_KEY: "PASTE_YOUR_PUBLISHABLE_KEY_HERE",

  // true = practice mode always on (tabs on this computer only, no Supabase).
  // You can also add ?practice=1 to the address instead.
  PRACTICE_MODE: false
};
