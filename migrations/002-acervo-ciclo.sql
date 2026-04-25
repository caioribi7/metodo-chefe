-- ============================================================
-- MIGRATION 002 — Acervo de materiais + Ciclo de estudos
-- Idempotente, seguro pra rodar mesmo se já instalou.
-- ============================================================

-- ===================== ACERVO =====================

create table if not exists public.pastas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'pasta' check (tipo in ('pasta','curso')),
  parent_id uuid references public.pastas(id) on delete cascade,
  descricao text,
  ordem int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_pastas_parent on public.pastas(parent_id, ordem);

create table if not exists public.materiais (
  id uuid primary key default gen_random_uuid(),
  pasta_id uuid references public.pastas(id) on delete cascade,
  tipo text not null check (tipo in ('pdf','video','dica','lista')),
  titulo text not null,
  descricao text,
  url text,
  conteudo text,
  ordem int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_materiais_pasta on public.materiais(pasta_id, ordem);

-- Storage: bucket público de PDFs e arquivos
insert into storage.buckets (id, name, public)
values ('acervo', 'acervo', true)
on conflict (id) do nothing;

-- ===================== CICLO DE ESTUDOS =====================

create table if not exists public.ciclo_metas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.profiles(id) on delete cascade,
  materia text not null,
  minutos_semanais int not null default 0 check (minutos_semanais >= 0),
  created_at timestamptz default now(),
  unique(aluno_id, materia)
);
create index if not exists idx_ciclo_aluno on public.ciclo_metas(aluno_id);

-- ===================== RLS =====================

alter table public.pastas enable row level security;
alter table public.materiais enable row level security;
alter table public.ciclo_metas enable row level security;

-- Pastas: todos autenticados leem, só admin escreve
drop policy if exists "pastas_select_auth" on public.pastas;
create policy "pastas_select_auth" on public.pastas
  for select using (auth.role() = 'authenticated');
drop policy if exists "pastas_all_admin" on public.pastas;
create policy "pastas_all_admin" on public.pastas
  for all using (public.is_admin()) with check (public.is_admin());

-- Materiais: igual
drop policy if exists "materiais_select_auth" on public.materiais;
create policy "materiais_select_auth" on public.materiais
  for select using (auth.role() = 'authenticated');
drop policy if exists "materiais_all_admin" on public.materiais;
create policy "materiais_all_admin" on public.materiais
  for all using (public.is_admin()) with check (public.is_admin());

-- Storage 'acervo': leitura pública, escrita só admin
drop policy if exists "acervo_select" on storage.objects;
create policy "acervo_select" on storage.objects
  for select using (bucket_id = 'acervo');
drop policy if exists "acervo_insert" on storage.objects;
create policy "acervo_insert" on storage.objects
  for insert with check (bucket_id = 'acervo' and public.is_admin());
drop policy if exists "acervo_update" on storage.objects;
create policy "acervo_update" on storage.objects
  for update using (bucket_id = 'acervo' and public.is_admin());
drop policy if exists "acervo_delete" on storage.objects;
create policy "acervo_delete" on storage.objects
  for delete using (bucket_id = 'acervo' and public.is_admin());

-- Ciclo: aluno vê e atualiza só o próprio; admin vê e escreve tudo
drop policy if exists "ciclo_select_own" on public.ciclo_metas;
create policy "ciclo_select_own" on public.ciclo_metas
  for select using (auth.uid() = aluno_id);
drop policy if exists "ciclo_select_admin" on public.ciclo_metas;
create policy "ciclo_select_admin" on public.ciclo_metas
  for select using (public.is_admin());
drop policy if exists "ciclo_all_admin" on public.ciclo_metas;
create policy "ciclo_all_admin" on public.ciclo_metas
  for all using (public.is_admin()) with check (public.is_admin());
