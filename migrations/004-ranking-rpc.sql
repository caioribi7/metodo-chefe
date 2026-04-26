-- ============================================================
-- MIGRATION 004 — RPC do ranking semanal (visível pra todos os alunos)
-- ============================================================

create or replace function public.ranking_semanal()
returns table(aluno_id uuid, nome text, minutos bigint, posicao bigint)
language sql
security definer
stable
set search_path = public
as $$
  with inicio as (
    select (current_date - ((extract(dow from current_date)::int + 6) % 7))::date as d
  ),
  somas as (
    select p.id as aluno_id, p.nome,
           coalesce(sum(s.duracao_minutos), 0)::bigint as minutos
    from public.profiles p
    left join public.sessoes_estudo s
      on s.aluno_id = p.id
     and s.data_estudo >= (select d from inicio)
    where p.role = 'aluno'
    group by p.id, p.nome
  )
  select aluno_id, nome, minutos,
         row_number() over (order by minutos desc, nome asc) as posicao
  from somas
  where minutos > 0
  order by minutos desc, nome asc;
$$;

grant execute on function public.ranking_semanal() to authenticated;

-- Idem, ranking total (todos os tempos)
create or replace function public.ranking_total()
returns table(aluno_id uuid, nome text, minutos bigint, posicao bigint)
language sql
security definer
stable
set search_path = public
as $$
  with somas as (
    select p.id as aluno_id, p.nome,
           coalesce(sum(s.duracao_minutos), 0)::bigint as minutos
    from public.profiles p
    left join public.sessoes_estudo s on s.aluno_id = p.id
    where p.role = 'aluno'
    group by p.id, p.nome
  )
  select aluno_id, nome, minutos,
         row_number() over (order by minutos desc, nome asc) as posicao
  from somas
  where minutos > 0
  order by minutos desc, nome asc;
$$;

grant execute on function public.ranking_total() to authenticated;
