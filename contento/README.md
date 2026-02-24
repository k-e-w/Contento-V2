# Contento

Contento is a Contentful custom app that lets marketers run tasks in plain language or via shortcut buttons.

## Features

- **Plain-language text box**: Type a request (e.g. “Find images missing alt text and generate alt text”).
- **Three buttons**:
  1. **Translate content** – List 3 most recently published entries missing a translation, offer to translate into Spanish and save to draft.
  2. **SEO optimize blog posts** – List 3 most recent published blog posts, offer to optimize for SEO and save to draft.
  3. **Generate alt text** – List 3 images missing alt text, offer to generate alt text and save to draft.

Each button shows a list of 3 candidates and asks “Yes” or “No”. If Yes, the backend runs the corresponding AI action and saves results as draft. If No, the app asks which entries or images to process; you can paste IDs.

## Setup

1. **Backend**: The app sends requests to a backend that implements `POST /api/execute`. Use the **alt-text-agent** backend in this repo (see `alt-text-agent/` and its env vars).
2. **Build**:
   ```bash
   npm install
   npm run build
   ```
3. **Backend URL**: When Contento is not served from the same origin as the backend, set the backend base URL:
   - Create `.env` with `VITE_CONTENTO_BACKEND_URL=https://your-backend.example.com`
   - Rebuild.
4. **Optional (dev without Contentful)**:
   - `VITE_DEFAULT_SPACE_ID` and `VITE_DEFAULT_ENVIRONMENT_ID` so the app can call the API without the Contentful SDK.

## Contentful app definition

1. In Contentful: **Apps** → **Create app** → **Create a custom app** (or use `contentful-app-manifest.json`).
2. Set the app name to **Contento** and add locations: **Sidebar** and/or **Page**.
3. Host the built app (e.g. upload the `dist/` folder to a host or use `npm run upload` if using Contentful’s CLI).
4. Install the app in your space and open it from the sidebar or as a page.

## App parameters (optional)

You can add an app parameter for the backend URL so each installation can point to a different backend (e.g. `backendUrl`). The app would read it from the SDK and use it instead of `VITE_CONTENTO_BACKEND_URL`.
