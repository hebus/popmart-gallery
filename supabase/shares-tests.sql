-- Tests de sécurité du partage chiffré (supabase/shares.sql).
-- À exécuter dans Supabase > SQL Editor APRÈS shares.sql. Tout est annulé à la fin (rollback).
-- Résultat attendu : la dernière ligne affichée est « OK : tous les tests de partage sont passés ».
-- Un échec arrête le script avec une erreur « FAIL: ... » (faille à corriger).

begin;

insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated');

-- ===== Alice crée un partage
reset role;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true); end $$;
set local role authenticated;

do $$ declare id uuid; begin
  id := public.create_share('AbC_123-xyz');
  perform set_config('t.share_id', id::text, true);
  if public.get_share(id) is distinct from 'AbC_123-xyz' then raise exception 'FAIL: get_share ne rend pas les données'; end if;
  raise notice 'OK: création et lecture';
end $$;

do $$ declare ok boolean := false; begin
  begin perform public.create_share('pas valide !'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: un format invalide est accepté'; end if;
  ok := false;
  begin perform public.create_share(''); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: une donnée vide est acceptée'; end if;
  ok := false;
  begin perform public.create_share(repeat('a', 8500001)); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: une donnée trop grosse est acceptée'; end if;
  raise notice 'OK: formats et tailles invalides refusés';
end $$;

do $$ declare ok boolean := false; begin
  begin perform 1 from public.shares limit 1; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: la table shares est lisible directement'; end if;
  ok := false;
  begin insert into public.shares (owner_id, data) values ('00000000-0000-0000-0000-0000000000a1', 'x'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: insertion directe possible dans shares'; end if;
  raise notice 'OK: accès direct à la table refusé';
end $$;

-- ===== Quota : 5 partages actifs maximum par utilisateur (Alice en a déjà 1)
do $$ declare ok boolean := false; i int; begin
  for i in 1..4 loop perform public.create_share('quota' || i); end loop;
  begin perform public.create_share('quota5'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: le quota de 5 partages n''est pas appliqué'; end if;
  raise notice 'OK: quota par utilisateur';
end $$;

-- ===== Visiteur non connecté (anon) : peut lire, ne peut ni créer ni supprimer
reset role;
set local role anon;
do $$ declare ok boolean := false; begin
  if public.get_share(current_setting('t.share_id')::uuid) is distinct from 'AbC_123-xyz' then raise exception 'FAIL: anon ne peut pas lire un partage'; end if;
  begin perform public.create_share('anon'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: anon peut créer un partage'; end if;
  ok := false;
  begin perform public.delete_share(current_setting('t.share_id')::uuid); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: anon peut supprimer un partage'; end if;
  if public.get_share('00000000-0000-0000-0000-00000000dead') is not null then raise exception 'FAIL: un id inconnu renvoie des données'; end if;
  raise notice 'OK: anon lit seulement';
end $$;

-- ===== Bob ne peut pas supprimer le partage d'Alice
reset role;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true); end $$;
set local role authenticated;
do $$ begin
  perform public.delete_share(current_setting('t.share_id')::uuid);
  if public.get_share(current_setting('t.share_id')::uuid) is null then raise exception 'FAIL: Bob a supprimé le partage d''Alice'; end if;
  raise notice 'OK: seul le propriétaire supprime';
end $$;

-- ===== Alice supprime son partage
reset role;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true); end $$;
set local role authenticated;
do $$ begin
  perform public.delete_share(current_setting('t.share_id')::uuid);
  if public.get_share(current_setting('t.share_id')::uuid) is not null then raise exception 'FAIL: la suppression par le propriétaire n''a pas marché'; end if;
  raise notice 'OK: révocation par le propriétaire';
end $$;

-- ===== Expiration (insertion en administrateur d'un partage déjà expiré)
reset role;
insert into public.shares (id, owner_id, data, expires_at)
values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000a1', 'expire', now() - interval '1 minute');
set local role anon;
do $$ begin
  if public.get_share('00000000-0000-0000-0000-00000000e001') is not null then raise exception 'FAIL: un partage expiré est encore lisible'; end if;
  raise notice 'OK: partage expiré illisible';
end $$;

reset role;
rollback;

-- Si vous voyez cette ligne, aucun test n'a échoué (un échec aurait arrêté le script avec une erreur FAIL).
select 'OK : tous les tests de partage sont passés' as resultat;
