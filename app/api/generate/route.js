import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseAdmin";

const CREDIT_COST = 1;

const MODELS = {
  "seedance-pro-fast": {
    id: "fal-ai/bytedance/seedance/v1/pro/fast/text-to-video",
    build: (p, f) => ({
      prompt: p,
      aspect_ratio: f.ratio,
      resolution: f.res,
      duration: f.dur,
      enable_safety_checker: true,
    }),
  },
  "seedance-2-mini": {
    id: "bytedance/seedance-2.0/mini/text-to-video",
    build: (p, f) => ({
      prompt: p,
      aspect_ratio: f.ratio,
      resolution: f.res,
      duration: f.dur,
    }),
  },
};

export async function POST(req) {
  // 1. Confirma quem está pedindo (token do Supabase, não um id solto no body)
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const { prompt, model, ratio, res, dur } = body || {};

  if (!prompt || typeof prompt !== "string" || prompt.length > 2000) {
    return NextResponse.json({ error: "Prompt inválido" }, { status: 400 });
  }
  const modelDef = MODELS[model];
  if (!modelDef) {
    return NextResponse.json({ error: "Modelo inválido" }, { status: 400 });
  }

  // 2. Desconta o crédito de forma atômica: só passa se credits >= custo.
  //    Isso evita que dois cliques ao mesmo tempo gerem 2 vídeos de graça.
  const { data: charged, error: chargeErr } = await supabaseAdmin.rpc(
    "charge_credits",
    { p_user_id: user.id, p_amount: CREDIT_COST }
  );
  if (chargeErr) {
    return NextResponse.json({ error: "Erro ao checar créditos" }, { status: 500 });
  }
  if (!charged) {
    return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });
  }

  // 3. Chama a fal.ai com a chave do SERVIDOR (nunca exposta ao navegador)
  const input = modelDef.build(prompt, { ratio, res, dur });
  let submitJson;
  try {
    const submitRes = await fetch(`https://queue.fal.run/${modelDef.id}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    if (!submitRes.ok) {
      const t = await submitRes.text();
      throw new Error(`fal.ai recusou o pedido (${submitRes.status}): ${t.slice(0, 200)}`);
    }
    submitJson = await submitRes.json();
  } catch (err) {
    // Devolve o crédito, já que a geração nem começou
    await supabaseAdmin.rpc("refund_credits", { p_user_id: user.id, p_amount: CREDIT_COST });
    return NextResponse.json({ error: err.message }, { status: 502 });
  }

  // 4. Registra o job (para o histórico) e devolve os dados para o front
  //    fazer o polling de status diretamente pela rota /api/status abaixo.
  const { data: job } = await supabaseAdmin
    .from("jobs")
    .insert({
      user_id: user.id,
      prompt,
      model,
    })
    .select()
    .single();

  return NextResponse.json({
    jobId: job?.id,
    requestId: submitJson.request_id,
    modelId: modelDef.id,
  });
}
