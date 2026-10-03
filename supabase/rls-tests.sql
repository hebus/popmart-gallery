-- Tests des règles de sécurité (RLS) de supabase/schema.sql.
-- À exécuter dans Supabase > SQL Editor APRÈS schema.sql. Tout est annulé à la fin (rollback) : aucune donnée n'est conservée.
-- Résultat attendu : la dernière ligne affichée est « OK : tous les tests de sécurité sont passés ». Un échec arrête le script avec une erreur « FAIL: ... » (faille à corriger). Les messages NOTICE ne s'affichent pas toujours dans l'éditeur Supabase.

begin;

insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated');
insert into public.profiles (id, pseudo) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice_test'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob_test'),
  ('00000000-0000-0000-0000-0000000000c3', 'carol_test');
insert into public.contacts (user_id, value) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@test'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@test'),
  ('00000000-0000-0000-0000-0000000000c3', 'carol@test');

-- Annonce de départ créée en administrateur (les clients n'ont pas le droit de choisir l'id)
insert into public.listings (id, owner_id, product_id, image_index, kind, qty)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', '9b553fac-1f37-4342-9f04-f8f967129f4b', 0, 'exchange', 1);

-- ===== Alice : une insertion normale (sans id) doit fonctionner
reset role;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true); end $$;
set local role authenticated;
do $$ begin
  insert into public.listings (owner_id, product_id, image_index, kind, price, qty, note)
  values ('00000000-0000-0000-0000-0000000000a1', '9b553fac-1f37-4342-9f04-f8f967129f4b', 5, 'sale', 12.5, 2, 'test');
  raise notice 'OK: Alice peut publier une annonce';
exception when others then
  raise exception 'FAIL: Alice ne peut pas publier une annonce (%)', sqlerrm;
end $$;

do $$ declare ok boolean := false; begin
  begin
    insert into public.interests (listing_id, user_id) values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: on peut taguer sa propre annonce'; end if;
  raise notice 'OK: impossible de taguer sa propre annonce';
end $$;

-- ===== Bob : tentatives interdites
reset role;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true); end $$;
set local role authenticated;

do $$ declare ok boolean := false; begin
  begin
    insert into public.notifications (recipient_id, listing_id, from_user_id)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000b2');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: un client peut forger une notification'; end if;
  raise notice 'OK: impossible de forger une notification';
end $$;

do $$ declare ok boolean := false; begin
  begin
    insert into public.listings (owner_id, product_id, image_index, kind)
    values ('00000000-0000-0000-0000-0000000000a1', '9b553fac-1f37-4342-9f04-f8f967129f4b', 1, 'exchange');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: on peut créer une annonce au nom d''un autre'; end if;
  raise notice 'OK: impossible de créer une annonce au nom d''un autre';
end $$;

do $$ declare n int; begin
  update public.listings set note = 'piraté' where id = '00000000-0000-0000-0000-00000000d001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: on peut modifier l''annonce d''un autre'; end if;
  raise notice 'OK: impossible de modifier l''annonce d''un autre';
end $$;

do $$ declare n int; begin
  select count(*) into n from public.contacts where user_id = '00000000-0000-0000-0000-0000000000a1';
  if n <> 0 then raise exception 'FAIL: contact lisible sans intérêt'; end if;
  raise notice 'OK: contact d''Alice invisible avant intérêt';
end $$;

-- ===== Bob tague l'annonce d'Alice
insert into public.interests (listing_id, user_id) values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000b2');

do $$ declare n int; begin
  select count(*) into n from public.contacts where user_id = '00000000-0000-0000-0000-0000000000a1';
  if n <> 1 then raise exception 'FAIL: Bob devrait voir le contact d''Alice après son intérêt'; end if;
  raise notice 'OK: Bob voit le contact d''Alice après son intérêt';
end $$;

-- ===== Alice reçoit la notification et voit le contact de Bob
reset role;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true); end $$;
set local role authenticated;

do $$ declare n int; begin
  select count(*) into n from public.notifications;
  if n <> 1 then raise exception 'FAIL: Alice devrait avoir 1 notification (%)', n; end if;
  select count(*) into n from public.contacts where user_id = '00000000-0000-0000-0000-0000000000b2';
  if n <> 1 then raise exception 'FAIL: Alice devrait voir le contact de Bob'; end if;
  raise notice 'OK: Alice reçoit la notification et voit le contact de Bob';
end $$;

do $$ declare ok boolean := false; begin
  begin
    update public.notifications set recipient_id = '00000000-0000-0000-0000-0000000000c3';
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: on peut rediriger une notification'; end if;
  raise notice 'OK: seule la colonne "read" est modifiable';
end $$;

-- ===== Carol (tierce) ne voit rien
reset role;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true); end $$;
set local role authenticated;

do $$ declare n int; begin
  select count(*) into n from public.contacts where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2');
  if n <> 0 then raise exception 'FAIL: une tierce personne lit des contacts'; end if;
  select count(*) into n from public.notifications;
  if n <> 0 then raise exception 'FAIL: une tierce personne lit des notifications'; end if;
  select count(*) into n from public.interests;
  if n <> 0 then raise exception 'FAIL: une tierce personne lit des intérêts'; end if;
  raise notice 'OK: une tierce personne ne voit ni contacts, ni notifications, ni intérêts';
end $$;

-- ===== Bob retire son tag : la notification disparaît
reset role;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true); end $$;
set local role authenticated;
delete from public.interests where listing_id = '00000000-0000-0000-0000-00000000d001';

reset role;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true); end $$;
set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from public.notifications;
  if n <> 0 then raise exception 'FAIL: la notification devrait disparaître avec le tag'; end if;
  raise notice 'OK: retirer le tag supprime la notification';
end $$;

-- ===== Visiteur non connecté (anon)
reset role;
set local role anon;
do $$ declare ok boolean := false; n int; begin
  select count(*) into n from public.listings;
  raise notice 'OK: anon lit les annonces (%)', n;
  begin
    perform 1 from public.contacts limit 1;
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: anon peut lire les contacts'; end if;
  raise notice 'OK: anon ne peut pas lire les contacts';
end $$;

reset role;
rollback;

-- Si vous voyez cette ligne, aucun test n'a échoué (un échec aurait arrêté le script avec une erreur FAIL).
select 'OK : tous les tests de sécurité sont passés' as resultat;
