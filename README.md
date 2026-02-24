# Contento V2

Contento is a chat interface inside Contentful that uses AI actions for bulk tasks (translate, SEO optimize, generate alt text).

## Structure

- **alt-text-agent/** – Backend (Next.js). Deploy to Vercel. Serves `/api/execute`.
- **contento/** – Frontend (React/Vite). Build locally and upload `dist/` to Contentful.

## Setup

See `CONTENTO-SETUP.md` in the project root (or `alt-text-agent/README-CONTENTO.md`) for deployment instructions.

