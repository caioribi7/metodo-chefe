-- ============================================================
-- MÉTODO CHEFE — Schema Supabase
-- Execute este arquivo inteiro no SQL Editor do Supabase
-- ============================================================

-- ---------- 1) TABELA DE PERFIS ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nome text not null,
  escolaridade text,
  prova_militar text,
  olimpiadas text[] default '{}',
  role text not null default 'aluno' check (role in ('aluno','admin')),
  created_at timestamptz default now()
);

-- ---------- 2) SESSÕES DE ESTUDO ----------
create table if not exists public.sessoes_estudo (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.profiles(id) on delete cascade,
  materia text not null,
  topico text,
  duracao_minutos integer not null check (duracao_minutos > 0),
  data_estudo date not null default current_date,
  observacoes text,
  created_at timestamptz default now()
);
create index if not exists idx_sessoes_aluno on public.sessoes_estudo(aluno_id, data_estudo desc);

-- ---------- 3) TAREFAS DE CASA (TCs) ----------
create table if not exists public.tarefas_casa (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.profiles(id) on delete cascade,
  criado_por uuid references public.profiles(id) on delete set null,
  titulo text not null,
  descricao text,
  materia text,
  prazo date,
  status text not null default 'pendente' check (status in ('pendente','concluida')),
  created_at timestamptz default now(),
  concluida_em timestamptz
);
create index if not exists idx_tcs_aluno on public.tarefas_casa(aluno_id, status, prazo);

-- ---------- 4) BANCO DE QUESTÕES ----------
create table if not exists public.questoes (
  id uuid primary key default gen_random_uuid(),
  enunciado text not null,
  materia text not null,
  assunto text,
  dificuldade text check (dificuldade in ('facil','medio','dificil')),
  fonte text,
  ano integer,
  alternativas jsonb,
  resposta_correta text,
  resolucao text,
  imagem_url text,
  imagem_resolucao_url text,
  tags text[] default '{}',
  created_at timestamptz default now()
);
create index if not exists idx_questoes_filtros on public.questoes(materia, dificuldade);

-- ---------- 4.1) STORAGE: bucket de imagens das questões ----------
insert into storage.buckets (id, name, public)
values ('questoes', 'questoes', true)
on conflict (id) do nothing;

-- ---------- 5) FUNÇÃO HELPER is_admin() ----------
-- Evita recursão em políticas RLS.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- 6) TRIGGER: cria profile automático após signup ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, escolaridade, prova_militar, olimpiadas)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'escolaridade',
    new.raw_user_meta_data->>'prova_militar',
    coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(new.raw_user_meta_data->'olimpiadas')),
      '{}'::text[]
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.sessoes_estudo enable row level security;
alter table public.tarefas_casa enable row level security;
alter table public.questoes enable row level security;

-- ---------- PROFILES ----------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());

-- ---------- SESSÕES DE ESTUDO ----------
drop policy if exists "sessoes_select_own" on public.sessoes_estudo;
create policy "sessoes_select_own" on public.sessoes_estudo
  for select using (auth.uid() = aluno_id);

drop policy if exists "sessoes_select_admin" on public.sessoes_estudo;
create policy "sessoes_select_admin" on public.sessoes_estudo
  for select using (public.is_admin());

drop policy if exists "sessoes_insert_own" on public.sessoes_estudo;
create policy "sessoes_insert_own" on public.sessoes_estudo
  for insert with check (auth.uid() = aluno_id);

drop policy if exists "sessoes_update_own" on public.sessoes_estudo;
create policy "sessoes_update_own" on public.sessoes_estudo
  for update using (auth.uid() = aluno_id);

drop policy if exists "sessoes_delete_own" on public.sessoes_estudo;
create policy "sessoes_delete_own" on public.sessoes_estudo
  for delete using (auth.uid() = aluno_id);

-- ---------- TCs ----------
drop policy if exists "tcs_select_own" on public.tarefas_casa;
create policy "tcs_select_own" on public.tarefas_casa
  for select using (auth.uid() = aluno_id);

drop policy if exists "tcs_select_admin" on public.tarefas_casa;
create policy "tcs_select_admin" on public.tarefas_casa
  for select using (public.is_admin());

drop policy if exists "tcs_insert_admin" on public.tarefas_casa;
create policy "tcs_insert_admin" on public.tarefas_casa
  for insert with check (public.is_admin());

drop policy if exists "tcs_update_own_status" on public.tarefas_casa;
create policy "tcs_update_own_status" on public.tarefas_casa
  for update using (auth.uid() = aluno_id);

drop policy if exists "tcs_update_admin" on public.tarefas_casa;
create policy "tcs_update_admin" on public.tarefas_casa
  for update using (public.is_admin());

drop policy if exists "tcs_delete_admin" on public.tarefas_casa;
create policy "tcs_delete_admin" on public.tarefas_casa
  for delete using (public.is_admin());

-- ---------- QUESTÕES ----------
drop policy if exists "questoes_select_auth" on public.questoes;
create policy "questoes_select_auth" on public.questoes
  for select using (auth.role() = 'authenticated');

drop policy if exists "questoes_all_admin" on public.questoes;
create policy "questoes_all_admin" on public.questoes
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- STORAGE: políticas do bucket 'questoes' ----------
drop policy if exists "questoes_img_select" on storage.objects;
create policy "questoes_img_select" on storage.objects
  for select using (bucket_id = 'questoes');

drop policy if exists "questoes_img_insert" on storage.objects;
create policy "questoes_img_insert" on storage.objects
  for insert with check (bucket_id = 'questoes' and public.is_admin());

drop policy if exists "questoes_img_update" on storage.objects;
create policy "questoes_img_update" on storage.objects
  for update using (bucket_id = 'questoes' and public.is_admin());

drop policy if exists "questoes_img_delete" on storage.objects;
create policy "questoes_img_delete" on storage.objects
  for delete using (bucket_id = 'questoes' and public.is_admin());

-- ============================================================
-- FIM — Depois de rodar isto, crie sua conta pelo app
-- e execute:
--   update public.profiles set role = 'admin' where id = auth.uid();
-- (ou use o e-mail: where nome = 'Seu Nome';)
-- ============================================================
