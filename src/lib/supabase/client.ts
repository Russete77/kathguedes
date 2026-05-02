"use client";

import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import type { Database } from "./database.types";

/**
 * Supabase client para Client Components.
 * Usa o token JWT do Clerk via useSession() para autenticar requests.
 * O Supabase valida o JWT via JWKS do Clerk (integração nativa).
 * Types gerados automaticamente via: npx supabase gen types typescript --project-id auplhaxwaecsppqizxej
 */
export function useSupabase() {
  const { session } = useSession();

  const client = useMemo(() => {
    return createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        async accessToken() {
          return session?.getToken() ?? null;
        },
      }
    );
  }, [session]);

  return client;
}
