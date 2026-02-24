# Contento backend (execute API)

The **Contento** app sends requests to this backend at `POST /api/execute`.

## Request body

- **Plain-language**: `{ spaceId, environmentId, message }` → returns a reply (or runs the Claude agent when implemented).
- **Button flows**:
  - **List**: `{ spaceId, environmentId, intent: "translate" | "seo" | "alt_text", step: "list" }` → returns `{ candidates, heading, prompt }`.
  - **Confirm Yes**: `{ spaceId, environmentId, intent, step: "confirm_yes", entryIds? | assetIds? }` → runs the AI action and returns `{ reply }`.
  - **Confirm No**: `{ spaceId, environmentId, intent, step: "confirm_no_followup" }` (no ids) → returns “Which entries/images do you want?”.
  - **Follow-up**: `{ spaceId, environmentId, intent, step: "followup", message }` (user pastes IDs) → runs the action for those IDs and returns `{ reply }`.

## Environment variables

Required:

- `CONTENTFUL_MANAGEMENT_ACCESS_TOKEN` – CMA token.

For **alt text** button:

- `CONTENTFUL_ALT_TEXT_AI_ACTION_ID` – ID of the “generate alt text” AI action.
- `CONTENTFUL_ALT_TEXT_AI_ACTION_ASSET_VARIABLE_ID` (optional) – variable ID for the image input.

For **Translate** button:

- `CONTENTFUL_TRANSLATE_AI_ACTION_ID` – ID of the Translate AI action.
- `CONTENTFUL_TARGET_TRANSLATION_LOCALE` (optional) – default `es`.

For **SEO** button:

- `CONTENTFUL_SEO_AI_ACTION_ID` – ID of the SEO optimization AI action.
- `CONTENTFUL_BLOG_CONTENT_TYPE_ID` (optional) – default `blogPost`.

Optional for Claude (free-form) later:

- `ANTHROPIC_API_KEY`.

## CORS

If Contento is hosted on a different origin (e.g. Contentful’s app host vs your Next.js backend), allow the Contento origin in your Next.js config or add CORS headers to `POST /api/execute`.

## Wiring Contento to this backend

1. **Same origin**: Build Contento (`cd contento && npm run build`) and serve the `contento/dist/` folder from the same host as the backend (e.g. copy `dist/*` to `alt-text-agent/public/contento/` and set the app’s URL to `https://your-domain.com/contento/`). The app will use relative `/api/execute` and the SDK will provide `spaceId`/`environmentId` when run inside Contentful.

2. **Different origin**: Set `VITE_CONTENTO_BACKEND_URL=https://your-backend.example.com` in Contento’s env, rebuild, then host the Contento build wherever you want. Ensure the backend allows CORS from the Contento origin.
