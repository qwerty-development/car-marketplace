---
description: Security rules for auth, payments, and data access
globs: ["utils/Auth*", "supabase/functions/**", "app/(auth)/**"]
---

# Security Rules

## Authentication
- Never trust client-side role checks alone — verify against `users` table profile
- Session tokens in SecureStore only — never AsyncStorage or plain storage
- OAuth callbacks must validate state parameter
- Guest users get a UUID stored in AsyncStorage — no access to protected data

## API & Edge Functions
- Validate `Authorization` header in every Edge Function
- Use `supabase.auth.getUser()` server-side — never trust client-provided user IDs
- Payment webhooks (Whish) must verify HMAC signatures with `APP_HMAC_SECRET`
- Rate limit credit operations to prevent abuse

## Data Access
- RLS policies enforce row-level security in PostgreSQL — don't bypass with service role key in client
- Dealer data queries must check `dealership_id` ownership
- User favorites stored as array on profile — validate car IDs exist before adding
- Never expose `supabase_service_role_key` in client code

## Secrets
- All secrets in `.env` (git-ignored) or Supabase dashboard env vars
- Google Maps API keys are in `app.json` (public) — restricted by bundle ID
- Never log or console.log auth tokens, even in development

## Input Validation
- Sanitize user input in chat messages before storage
- Validate image uploads: check MIME type, enforce size limits via `react-native-compressor`
- Phone numbers validated via `react-native-phone-number-input` before Supabase auth

## Tool Dispatch
- **semgrep:** Fires automatically on every edit — review its findings before proceeding
- **api-tester agent:** Dispatch after changes to auth logic, RLS policies, Edge Functions, or payment webhooks
- **coderabbit:code-review:** Verify all security-sensitive changes (auth, payments, data access) before merging
- **context7 MCP:** Verify Supabase Auth API usage against current docs before modifying auth flows
