-- ============================================================
-- MIGRATION 005 — Fórum de dúvidas
-- ============================================================

create table if not exists public.topicos_duvidas (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.profiles(id) on delete cascade,
  titulo text not null,
  conteudo text not null,
  materia text,
  resolvido boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists idx_topicos_created on public.topicos_duvidas(created_at desc);
create index if not exists idx_topicos_materia on public.topicos_duvidas(materia);

create table if not exists public.respostas_duvidas (
  id uuid primary key default gen_random_uuid(),
  topico_id uuid not null references public.topicos_duvidas(id) on delete cascade,
  autor_id uuid not null references public.profiles(id) on delete cascade,
  conteudo text not null,
  marcada_solucao boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_respostas_topico on public.respostas_duvidas(topico_id, created_at);

alter table public.topicos_duvidas enable row level security;
alter table public.respostas_duvidas enable row level security;

-- Tópicos: todos autenticados leem; criar = qualquer; alterar/excluir = autor ou admin
drop policy if exists "topicos_select_auth" on public.topicos_duvidas;
create policy "topicos_select_auth" on public.topicos_duvidas
  for select using (auth.role() = 'authenticated');

drop policy if exists "topicos_insert_auth" on public.topicos_duvidas;
create policy "topicos_insert_auth" on public.topicos_duvidas
  for insert with check (auth.uid() = autor_id);

drop policy if exists "topicos_update_owner_admin" on public.topicos_duvidas;
create policy "topicos_update_owner_admin" on public.topicos_duvidas
  for update using (auth.uid() = autor_id or public.is_admin());

drop policy if exists "topicos_delete_owner_admin" on public.topicos_duvidas;
create policy "topicos_delete_owner_admin" on public.topicos_duvidas
  for delete using (auth.uid() = autor_id or public.is_admin());

-- Respostas: idem
drop policy if exists "respostas_select_auth" on public.respostas_duvidas;
create policy "respostas_select_auth" on public.respostas_duvidas
  for select using (auth.role() = 'authenticated');

drop policy if exists "respostas_insert_auth" on public.respostas_duvidas;
create policy "respostas_insert_auth" on public.respostas_duvidas
  for insert with check (auth.uid() = autor_id);

drop policy if exists "respostas_update_owner_admin" on public.respostas_duvidas;
create policy "respostas_update_owner_admin" on public.respostas_duvidas
  for update using (auth.uid() = autor_id or public.is_admin());

drop policy if exists "respostas_delete_owner_admin" on public.respostas_duvidas;
create policy "respostas_delete_owner_admin" on public.respostas_duvidas
  for delete using (auth.uid() = autor_id or public.is_admin());

-- View que agrega respostas + autor + contagem
create or replace view public.topicos_duvidas_view as
  select t.*,
         p.nome as autor_nome,
         p.role as autor_role,
         (select count(*) from public.respostas_duvidas r where r.topico_id = t.id) as qtd_respostas
  from public.topicos_duvidas t
  join public.profiles p on p.id = t.autor_id;

grant select on public.topicos_duvidas_view to authenticated;

create or replace view public.respostas_duvidas_view as
  select r.*,
         p.nome as autor_nome,
         p.role as autor_role
  from public.respostas_duvidas r
  join public.profiles p on p.id = r.autor_id;

grant select on public.respostas_duvidas_view to authenticated;
