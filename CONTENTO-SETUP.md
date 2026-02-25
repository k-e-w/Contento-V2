# Contento Setup Guide

This guide walks you through deploying Contento and fixing 403 errors by configuring the backend, CORS, API keys, and app parameters.

---

## 1. Deploy the Backend (alt-text-agent)

The Contento app sends requests to the **alt-text-agent** Next.js backend. Deploy it first.

### Option A: Deploy to Vercel

1. Push `alt-text-agent` to GitHub (see `alt-text-agent/DEPLOY.md`).
2. Import the repo in [Vercel](https://vercel.com) and deploy.
3. Note your deployment URL (e.g. `https://alt-text-agent-xxx.vercel.app`).

### Option B: Deploy elsewhere

Deploy the `alt-text-agent` folder to any Node.js host (Railway, Render, etc.). Ensure it supports Next.js and that the app is served over HTTPS.

---

## 2. CORS (already configured)

The backend is configured to allow requests from Contentful’s app host. The middleware in `alt-text-agent/src/middleware.ts` adds CORS headers for:

- `https://app.contentful.com`
- `https://*.contentful.com`
- `localhost` (for local development)

If you host the app on a different origin, add it to `ALLOWED_ORIGINS` in that middleware.

---

## 3. Backend Environment Variables

Set these in your hosting platform (Vercel, etc.):

| Variable | Required | Notes |
|----------|----------|-------|
| `CONTENTFUL_MANAGEMENT_ACCESS_TOKEN` | **Yes** | Contentful CMA token. Create from **Settings → API keys → Content management tokens** |
| `CONTENTFUL_ALT_TEXT_AI_ACTION_ID` | For alt text | ID of your “Generate alt text” AI action |
| `CONTENTFUL_ALT_TEXT_AI_ACTION_ASSET_VARIABLE_ID` | Optional | Variable ID for the image input (if different from default) |
| `CONTENTFUL_TRANSLATE_AI_ACTION_ID` | For translate | ID of your Translate AI action |
| `CONTENTFUL_SEO_AI_ACTION_ID` | For SEO | ID of your SEO optimization AI action |
| `CONTENTFUL_TARGET_TRANSLATION_LOCALE` | Optional | Default `es` |
| `CONTENTFUL_BLOG_CONTENT_TYPE_ID` | Optional | Default `blogPost` |
| `ANTHROPIC_API_KEY` | For future Claude | Optional |

### Finding AI action IDs

1. In Contentful: **Settings → AI Actions** (or your app’s AI actions).
2. Open each AI action and copy its ID from the URL or settings.

---

## 4. Contentful App Definition

1. Go to **Account → Organization settings → Apps**.
2. Open your Contento app definition.
3. Add the **App configuration** location (`app-config`) so users can set the backend URL.
4. Ensure **Page** and **Entry sidebar** are enabled.

---

## 5. Configure the Backend URL in Contento

Two options:

### Option A: Installation parameters (recommended)

1. In the app definition, add the **App configuration** location.
2. When installing the app in a space, you’ll see the configuration screen.
3. Enter the backend URL (e.g. `https://alt-text-agent-xxx.vercel.app`) and save.

### Option B: Build-time

1. Build with the backend URL:

   ```bash
   cd contento
   VITE_CONTENTO_BACKEND_URL=https://your-backend.vercel.app npm run build
   ```

2. Upload the new `dist` contents to Contentful.

---

## 6. Host Contento (External source – recommended)

Contento is built and served from the backend so you don’t need to upload `dist` to Contentful.

1. Build Contento with your backend URL:
   ```bash
   cd contento
   VITE_CONTENTO_BACKEND_URL=https://your-backend.vercel.app npm run build
   ```

2. Copy the build into the backend:
   ```bash
   cp -r dist/* ../alt-text-agent/public/contento/
   ```

3. Commit and push so Vercel redeploys with the new frontend.

4. In Contentful: **App details → Frontend**:
   - Turn off **Hosted by Contentful**
   - Choose **External source**
   - Set the app URL to: `https://your-backend.vercel.app/contento/` (must end with `/`)

### Alternative: Contentful hosting (drag-and-drop)

If you prefer Contentful hosting, build with the backend URL and upload the `dist` contents to Contentful. This can cause “App failed to load” in some setups; external hosting is more reliable.

---

## 7. MCP Server (Separate Setup)

The Contentful MCP server is a separate tool for AI-assisted development. It is not part of the Contento app. To use it with your space:

1. See [Contentful MCP docs](https://contentful.com/developers/docs/tools/mcp-server/).
2. Configure it with your space ID and credentials.
3. It runs outside Contentful and connects to your space via the API.

---

## Checklist

- [ ] Backend deployed (e.g. `https://your-backend.vercel.app`)
- [ ] Backend env vars set (CMA token, AI action IDs)
- [ ] CORS enabled (middleware in place)
- [ ] Contento built with backend URL and copied to `alt-text-agent/public/contento/`
- [ ] Contentful app set to **External source** with URL `https://your-backend.vercel.app/contento/`
- [ ] App installed in your space with backend URL configured

---

## Troubleshooting

**403 errors**

- Confirm CORS is allowed for your origin.
- Confirm the backend URL is correct.
- Check the browser Network tab for the actual request URL and response.

**“CONTENTFUL_MANAGEMENT_ACCESS_TOKEN is not set”**

- Backend env vars are missing.

**AI action not found**

- Ensure the AI action IDs match your space and environment.
