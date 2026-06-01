# Frontend (React + TypeScript + Vite)

## Purpose
- Functional UI for App Gestion modules:
   - Dashboard and KPIs
   - Projects
   - Consultants
   - Time entries workflow (approve/reject)
   - Expenses
   - Forecasts
- Connects to backend API via `VITE_API_URL`.
- Uses orange brand style tokens and responsive layout.

## Local quick start
1. Install dependencies:
   - `npm install`
2. Set environment variable:
   - Create `.env` from `.env.example`
3. Run app:
   - `npm run dev`

## Build and run
- `npm run build`
- `npm run start` (serves built files using `server.mjs`)

## Vercel
- Root directory: `frontend`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Configure `VITE_API_URL` with the Render backend public URL.
- Configure `VITE_FORCE_LOCAL_AUTH=true` for demo mode, or `false` for Microsoft Entra auth.
- `vercel.json` rewrites SPA routes like `/home` back to `index.html`.
- `public/env.js` provides an empty runtime config fallback so the static Vercel build does not 404 on `/env.js`.
