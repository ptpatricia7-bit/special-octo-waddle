import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseAdmin";

// GET /api/status?jobId=...&modelId=...&requestId=...
export async function GET(req) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const modelId = searchParams.get("modelId");
  const requestId = searchParams.get("requestId");
  if (!jobId || !modelId || !requestId) {
    return NextResponse.json({ error: "Parâmetros faltando" }, { status: 400 });
  }

  const statusRes = await fetch(
    `https://queue.fal.run/${modelId}/requests/${requestId}/status`,
    { headers: { Authorization: `Key ${process.env.FAL_KEY}` } }
  );
  if (!statusRes.ok) {
    return NextResponse.json({ error: `Erro de status (${statusRes.status})` }, { status: 502 });
  }
  const status = await statusRes.json();

  if (status.status !== "COMPLETED") {
    return NextResponse.json({ status: status.status });
  }

  const resultRes = await fetch(`https://queue.fal.run/${modelId}/requests/${requestId}`, {
    headers: { Authorization: `Key ${process.env.FAL_KEY}` },
  });
  if (!resultRes.ok) {
    return NextResponse.json({ error: `Erro ao buscar resultado (${resultRes.status})` }, { status: 502 });
  }
  const result = await resultRes.json();
  const videoUrl = result?.video?.url || null;

  await supabaseAdmin
    .from("jobs")
    .update({ video_url: videoUrl, error: videoUrl ? null : "sem vídeo no resultado" })
    .eq("id", jobId)
    .eq("user_id", user.id);

  return NextResponse.json({ status: "COMPLETED", videoUrl });
}
