# Vercel deployment

## Build settings
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

## Environment variables

Add these in Vercel → Project Settings → Environment Variables:

- `VITE_SUPABASE_URL` — your Supabase Project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase browser-safe publishable/anon key

If these variables are missing, the dashboard will still load and show the Login screen with a clear configuration message. Login will remain disabled until Supabase is configured.

## Security
Never put a Supabase service-role/secret key in this frontend project.
