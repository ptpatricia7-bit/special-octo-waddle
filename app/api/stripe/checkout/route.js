import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getUserFromRequest } from "@/lib/supabaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const session = await stripe.checkout.sessions.create({
    mode: "payment", // troque para "subscription" se preferir assinatura mensal
    payment_method_types: ["card"],
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    // guardamos o id do usuário para o webhook saber quem creditar
    client_reference_id: user.id,
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?pago=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?pago=0`,
  });

  return NextResponse.json({ url: session.url });
}
