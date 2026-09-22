import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Quantos créditos cada compra libera. Ajuste ao seu preço/pacote.
const CREDITS_PER_PURCHASE = 50;

export async function POST(req) {
  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // Assinatura inválida = não veio de verdade do Stripe. Rejeita.
    return NextResponse.json({ error: `Assinatura inválida: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.client_reference_id;
    if (userId) {
      await supabaseAdmin.rpc("add_credits", {
        p_user_id: userId,
        p_amount: CREDITS_PER_PURCHASE,
      });
    }
  }

  return NextResponse.json({ received: true });
}
