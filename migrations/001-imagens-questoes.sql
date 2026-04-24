-- ============================================================
-- MIGRATION 001 — Imagens nas questões
-- Rode este script no SQL Editor do Supabase. Seguro pra rodar
-- mesmo se já estiver instalado (idempotente).
-- ============================================================

-- 1) Colunas de imagem na tabela questoes
alter table public.questoes
  add column if not exists imagem_url text,
  add column if not exists imagem_resolucao_url text;

-- 2) Bucket público de imagens
insert into storage.buckets (id, name, public)
values ('questoes', 'questoes', true)
on conflict (id) do nothing;

-- 3) Políticas de storage
-- Leitura: qualquer pessoa autenticada (bucket é public, mas garantimos)
drop policy if exists "questoes_img_select" on storage.objects;
create policy "questoes_img_select" on storage.objects
  for select using (bucket_id = 'questoes');

-- Upload: apenas admin
drop policy if exists "questoes_img_insert" on storage.objects;
create policy "questoes_img_insert" on storage.objects
  for insert with check (bucket_id = 'questoes' and public.is_admin());

drop policy if exists "questoes_img_update" on storage.objects;
create policy "questoes_img_update" on storage.objects
  for update using (bucket_id = 'questoes' and public.is_admin());

drop policy if exists "questoes_img_delete" on storage.objects;
create policy "questoes_img_delete" on storage.objects
  for delete using (bucket_id = 'questoes' and public.is_admin());
