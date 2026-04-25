-- ============================================================
-- MIGRATION 003 — Banco de questões: escolaridade, nível, instituição
-- Idempotente.
-- ============================================================

alter table public.questoes
  add column if not exists escolaridade text,
  add column if not exists nivel int,
  add column if not exists instituicao text;

-- Constraint de nivel (1 a 4) — só adiciona se não existir
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'questoes_nivel_check'
  ) then
    alter table public.questoes
      add constraint questoes_nivel_check check (nivel is null or nivel between 1 and 4);
  end if;
end $$;

create index if not exists idx_questoes_inst on public.questoes(instituicao);
create index if not exists idx_questoes_nivel on public.questoes(nivel);
create index if not exists idx_questoes_escol on public.questoes(escolaridade);
