import { createClient } from "@supabase/supabase-js";

// ATENÇÃO: usa a service_role key, que ignora RLS.
// Só pode ser importado dentro de rotas /app/api/** (código de servidor).
// Nunca importe este arquivo em um componente "use client".
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Confirma quem é o usuário a partir do token enviado pelo navegador
// (Authorization: Bearer <access_token>). Nunca confie em um user_id
// que o próprio navegador diga que é ele.
export async function getUserFromRequest(req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace("Bearer ", "");
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
