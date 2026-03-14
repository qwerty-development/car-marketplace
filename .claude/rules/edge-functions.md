---
description: Supabase Edge Functions (Deno runtime) conventions
globs: ["supabase/functions/**"]
---

# Edge Functions Rules

## Runtime
- Deno runtime, NOT Node.js — use `Deno.serve()`, `Deno.env.get()`, URL imports
- Import from `https://esm.sh/` for npm packages (e.g., `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'`)
- Use `https://deno.land/std/` for standard library modules

## Structure
- Each function in its own directory: `supabase/functions/<name>/index.ts`
- Entry point is always `index.ts`
- Shared code in `supabase/functions/_shared/` (underscore prefix = not deployed)

## Auth & Security
- Always verify JWT from `Authorization` header: `supabase.auth.getUser(token)`
- Never trust client-provided user IDs — extract from verified JWT
- Whish payment webhooks: verify HMAC with `APP_HMAC_SECRET` before processing
- Environment variables via `Deno.env.get('VAR_NAME')` — set in Supabase dashboard

## Error Handling
- Return proper HTTP status codes (400 for bad input, 401 for unauth, 500 for server error)
- Always return JSON responses with `{ error: string }` shape on failure
- Log errors with `console.error()` for Supabase dashboard visibility

## Deployment
- Deploy: `supabase functions deploy <function-name>`
- Test locally: `supabase functions serve <function-name> --env-file .env`
- See `SUPABASE_ENV_VARIABLES.md` for required env vars per function

## Tool Dispatch
- **context7 MCP:** Verify Supabase Edge Functions / Deno API usage against current docs — runtime differences from Node.js are subtle
- **api-tester agent:** Dispatch after building or modifying Edge Functions — verify functional, security, and performance before deploying
- **database-optimizer agent:** Dispatch if the Edge Function runs complex SQL queries — optimize before deploying
- **coderabbit:code-review:** Verify completed Edge Functions meet quality standards before deployment
