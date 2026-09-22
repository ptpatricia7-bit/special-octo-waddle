"use client";
import { createClient } from "@supabase/supabase-js";

// Usado no navegador: só consegue ler/escrever o que a RLS permitir
// (ver supabase/schema.sql). Nunca tem acesso à service_role key.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
