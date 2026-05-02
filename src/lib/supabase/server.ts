import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Supabase client para Server Components, Route Handlers e Server Actions.
 * Usa auth() do Clerk para obter o token JWT server-side.
 * O Supabase valida o JWT via JWKS do Clerk (integração nativa).
 * Types gerados automaticamente via: npx supabase gen types typescript --project-id auplhaxwaecsppqizxej
 */
export async function createServerSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      async accessToken() {
        return (await auth()).getToken();
      },
    }
  );
}

/**
 * Supabase Admin client — bypass RLS.
 * APENAS para operações server-side que precisam de acesso total
 * (webhooks, cron jobs, operações admin).
 * Sem generic Database — service_role tem acesso total, types inferidos em runtime.
 */
export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("[supabase] Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  }
  return createClient<Database>(url, key);
}
