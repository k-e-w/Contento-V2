# Deploy Alt Text Agent

## 1. Push to GitHub

From the `alt-text-agent` folder:

```bash
git init
git add .
git commit -m "Alt text agent ready for deploy"
```

Create a **new repository** on [GitHub](https://github.com/new):
- Name it e.g. `alt-text-agent`
- Do not add a README, .gitignore, or license (we already have them)
- Create the repo, then run (replace `YOUR_USERNAME` and `YOUR_REPO` with your values):

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

## 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. Click **Add New** → **Project**.
3. **Import** the `alt-text-agent` repository.
4. **Root Directory:** leave as default (`.`); the repo is the app.
5. **Environment Variables** – add these (required for the app to work):

   | Name                                 | Value                    | Notes                    |
   |--------------------------------------|--------------------------|--------------------------|
   | `CONTENTFUL_MANAGEMENT_ACCESS_TOKEN` | `CFPAT-...`              | Your Contentful CMA token |
   | `CONTENTFUL_ALT_TEXT_AI_ACTION_ID`   | `5met2frd2OGEqRfUBZHUTN` | Your alt-text AI Action  |

   Optional (only if you use a specific variable for the image input):

   | Name                                              | Value   |
   |---------------------------------------------------|--------|
   | `CONTENTFUL_ALT_TEXT_AI_ACTION_ASSET_VARIABLE_ID` | variable id |

6. Click **Deploy**. Vercel runs `npm run build` and hosts the app.
7. When it finishes, open the project URL (e.g. `https://alt-text-agent-xxx.vercel.app`) and share it with colleagues.

## 3. After deploy

- **Secrets:** Tokens exist only in Vercel’s env vars; never commit `.env.local`.
- **Space:** The app uses space `a7d65bkvekfx` and environment `master`; colleagues will generate alt text for that space.
- **HTTPS:** The site is served over HTTPS; the CMA token is only sent from Vercel’s server to Contentful.
