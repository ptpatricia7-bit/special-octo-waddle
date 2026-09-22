-- Rode isto uma vez em: Supabase > SQL Editor > New query

-- Tabela de perfis, 1 linha por usuário, com o saldo de créditos
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  credits integer not null default 5,     -- créditos grátis de boas-vindas
  created_at timestamptz not null default now()
);

-- Cria o perfil automaticamente quando alguém se cadastra
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Histórico de gerações
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  prompt text not null,
  model text not null,
  video_url text,
  error text,
  created_at timestamptz not null default now()
);

-- Segurança: cada usuário só enxerga os próprios dados
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;

create policy "usuário vê o próprio perfil" on public.profiles
  for select using (auth.uid() = id);

create policy "usuário vê os próprios jobs" on public.jobs
  for select using (auth.uid() = user_id);

-- Desconta créditos de forma atômica (evita corrida entre pedidos simultâneos).
-- Retorna true se conseguiu descontar, false se não tinha saldo.
create or replace function public.charge_credits(p_user_id uuid, p_amount integer)
returns boolean as $$
declare
  ok boolean;
begin
  update public.profiles
    set credits = credits - p_amount
    where id = p_user_id and credits >= p_amount;
  get diagnostics ok = row_count;
  return ok > 0;
end;
$$ language plpgsql security definer;

create or replace function public.refund_credits(p_user_id uuid, p_amount integer)
returns void as $$
begin
  update public.profiles set credits = credits + p_amount where id = p_user_id;
end;
$$ language plpgsql security definer;

create or replace function public.add_credits(p_user_id uuid, p_amount integer)
returns void as $$
begin
  update public.profiles set credits = credits + p_amount where id = p_user_id;
end;
$$ language plpgsql security definer;

-- Observação: INSERT/UPDATE em profiles.credits e em jobs só acontece
-- pelo backend, usando a service_role key (que ignora RLS). O navegador
-- do cliente nunca tem permissão de escrever créditos diretamente.
