FUT - Web fallback for auth callbacks

This folder contains a minimal fallback page you can host at /auth/callback (or similar)
that will capture the fragment (#access_token=...) or query string sent by Supabase and
redirect to the mobile app deep link preserving the tokens.

How to use

1. Host `index.html` at a public URL, e.g. `https://example.com/auth/callback`.
2. In Supabase Dashboard -> Auth -> Settings -> Redirect URLs add that URL and also
   the app deep link `futapp://auth-callback`.
3. When sending signUp/reset requests from the app or server include redirectTo/emailRedirectTo
   pointing to `futapp://auth-callback` (or the web fallback URL if you prefer web first).

Notes

- The page reads both the URL fragment (#) and the query string (?) and constructs the deep
  link `futapp://auth-callback#<fragment-or-query>` to preserve the tokens.
- If the user's browser blocks automatic redirects to custom schemes, the page shows an
  "Abrir app" button and displays the deep link so it can be copied.
- For production you may want to add content for download links and analytics.

Security

- This page does not exchange tickets for sessions; if your Supabase setup returns only a
  "ticket" (and not tokens), you'll need a server endpoint to safely exchange the ticket
  for tokens using the `service_role` key, then redirect to the deep link with tokens.
- Never expose `service_role` in client-side code.
