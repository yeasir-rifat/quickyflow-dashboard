# Vercel deployment

## Build settings
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

## Environment variables

Add these variables in Vercel Project Settings → Environment Variables:

`VITE_SUPABASE_URL`
- Value: your Supabase project URL, e.g. `https://YOUR_PROJECT_REF.supabase.co`

`VITE_SUPABASE_ANON_KEY`
- Value: your Supabase browser-safe publishable/anon key

Apply them to the environments you use (Preview and Production as needed), then redeploy.

## Security
Never put a Supabase service-role/secret key in this frontend project. Only use the browser-safe publishable/anon key.

## Local development
Copy `.env.example` to `.env.local` and replace the placeholders with your Supabase values.
