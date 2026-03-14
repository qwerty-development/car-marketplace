---
description: Supabase database and Edge Function conventions
globs: ["utils/supabase*", "utils/*Context*", "supabase/**", "services/**"]
---

# Database & Supabase Rules

## Client Usage
- Single client instance in `utils/supabase.ts` — never create additional clients
- Auth tokens stored in `expo-secure-store` (not AsyncStorage)
- Realtime subscriptions: max 10 events/sec (configured in client)

## Query Patterns
- `.single()` throws PGRST116 when 0 rows — ALWAYS guard: `if (error?.code !== 'PGRST116')`
- Never show Alert on PGRST116 — it's expected for "not found" queries
- Use `.maybeSingle()` when 0 rows is a valid outcome
- Prefer RPC functions (`supabase.rpc('function_name')`) for complex operations

## Edge Functions (supabase/functions/)
- Written in Deno/TypeScript — NOT Node.js
- Each function in its own directory with `index.ts`
- Environment variables via Supabase dashboard (see `SUPABASE_ENV_VARIABLES.md`)
- Deploy: `supabase functions deploy <function-name>`
- Key functions: credit-operations, whish-create-payment, process-notifications

## Auth
- Dual init: `loadSession()` (immediate) + `onAuthStateChange()` (reactive)
- Profile role (`user` | `dealer`) determines routing in `(home)/_layout.tsx`
- `(dealer)` pages can briefly mount for non-dealer users during routing — keep fetches defensive
- OAuth: Apple SignIn + Google SignIn via expo-auth-session

## Realtime
- Credit balance updates via channel subscriptions
- Message delivery notifications
- Use `supabase.channel()` — clean up subscriptions in useEffect cleanup

## Tool Dispatch
- **context7 MCP:** Verify Supabase JS client API usage against current docs — methods and signatures change between versions
- **database-optimizer agent:** Dispatch for new tables, schema changes, slow queries, RLS policy reviews, or index optimization
- **api-tester agent:** Dispatch after changing auth logic, RPC functions, or credit/payment operations — verify before deploying
- **coderabbit:code-review:** Verify database-related changes meet quality standards before merging
