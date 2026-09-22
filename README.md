# Workspace — vídeos sociais com IA

App para gerar vídeos com IA (fal.ai), com login, créditos e pagamento via Stripe.

## Como funciona a segurança

- A chave da **fal.ai** e a `service_role key` do Supabase só existem no servidor
  (variáveis de ambiente lidas dentro de `app/api/**`). O navegador do cliente
  nunca recebe essas chaves.
- Créditos são descontados no servidor, de forma atômica (`charge_credits` no
  banco), antes de chamar a fal.ai — impossível gerar sem saldo, mesmo
  clicando duas vezes rápido.
- Créditos só aumentam quando o **webhook do Stripe** confirma um pagamento de
  verdade (assinatura verificada com `STRIPE_WEBHOOK_SECRET`). O cliente nunca
  pode "se dar" créditos direto pelo navegador.

## Passo a passo para colocar no ar

### 1. Rodar localmente primeiro

```bash
npm install
cp .env.example .env.local   # depois preencha com suas chaves reais
npm run dev
```

Abra http://localhost:3000.

### 2. Criar o projeto no Supabase (login + banco)

1. Crie um projeto em https://supabase.com
2. Vá em **SQL Editor** → cole o conteúdo de `supabase/schema.sql` → Run
3. Vá em **Authentication → Providers** e confirme que "Email" (magic link) está ativo
4. Vá em **Project Settings → API** e copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ nunca exponha essa no navegador)

### 3. Criar a chave da fal.ai

1. https://fal.ai/dashboard/keys → gerar chave
2. Cole em `FAL_KEY`

### 4. Configurar o Stripe

1. Crie uma conta em https://dashboard.stripe.com
2. Em **Products**, crie um produto "Pacote de créditos" com um preço único (ex: R$29,90) → copie o `price_id` para `STRIPE_PRICE_ID`
3. Em **Developers → API keys**, copie a `Secret key` para `STRIPE_SECRET_KEY`
4. Ajuste `CREDITS_PER_PURCHASE` em `app/api/stripe/webhook/route.js` para quantos créditos esse pacote libera
5. O `STRIPE_WEBHOOK_SECRET` você só pega depois de fazer o deploy (passo 6)

### 5. Subir para o GitHub

Dentro da pasta do projeto:

```bash
git init
git add .
git commit -m "primeira versão do workspace"
git branch -M main
git remote add origin https://github.com/ptpatricia7-bit/special-octo-waddle.git
git push -u origin main
```

O `.gitignore` já impede que `.env.local` (suas chaves secretas) suba junto.

### 6. Deploy na Vercel

1. https://vercel.com → **Add New Project** → importe `special-octo-waddle`
2. Em **Environment Variables**, adicione todas as variáveis do `.env.example`
   (com os valores reais) — exceto `STRIPE_WEBHOOK_SECRET`, que vem no próximo passo
3. Deploy
4. Depois de publicado, copie a URL do site (ex: `https://special-octo-waddle.vercel.app`)
   e coloque em `NEXT_PUBLIC_SITE_URL` (nas variáveis de ambiente da Vercel)

### 7. Ligar o webhook do Stripe

1. No Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `https://SEU-SITE.vercel.app/api/stripe/webhook`
3. Evento: `checkout.session.completed`
4. Copie o **Signing secret** → adicione como `STRIPE_WEBHOOK_SECRET` na Vercel
5. Faça um novo deploy (ou "Redeploy") para a variável valer

### 8. Teste de ponta a ponta

1. Acesse o site publicado, entre com seu e-mail (chega um link mágico)
2. Você começa com 5 créditos grátis (definido em `supabase/schema.sql`)
3. Gere um vídeo, veja aparecer no histórico
4. Teste uma compra com o [cartão de teste do Stripe](https://docs.stripe.com/testing) `4242 4242 4242 4242`
5. Quando estiver tudo certo, troque as chaves de teste do Stripe pelas de produção (`sk_live_...`) e repita o passo do webhook com o modo "Live" ativado

## O que ainda vale adicionar antes de vender para o público

- **Rate limiting** por IP/usuário na rota `/api/generate` (ex: Upstash Ratelimit) para evitar abuso
- **Termos de uso e política de reembolso** (créditos não usados, geração que falha, etc.)
- **Moderação de prompt** — decidir o que seu app permite gerar
- Ajustar `CREDIT_COST` em `app/api/generate/route.js` para o valor real que cobre seu custo com a fal.ai + margem
