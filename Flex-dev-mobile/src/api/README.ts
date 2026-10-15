/**
 * Trainer mobile API layer — same Supabase helpers as Flex-dev-web-trainer.
 *
 * src/api/supabase.ts     shared browser/mobile client (anon key + AsyncStorage)
 * src/api/fetches/        reads
 * src/api/upserts/        writes
 * src/api/deletions/      deletes
 * src/api/utils/          macros, dates, billing math
 * src/api/auth/           trainer sign-in
 * src/api/fetches/searchcatalog.ts  trigram search RPCs
 *
 * Admin-only web helpers (service role, Next server) are not copied here.
 * Screens should import from here, not talk to PostgREST directly.
 */
export {}
