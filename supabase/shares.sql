-- Pop Mart : partage chiffré de la collection (figurines perso + photos), valable 24 h.
-- À exécuter une fois dans Supabase > SQL Editor (rejouable). Prérequis : schema.sql déjà exécuté et
-- Authentication > "Allow anonymous sign-ins" activé.
--
-- Principe : le navigateur chiffre la collection (AES-GCM), la clé reste dans le lien (fragment #, jamais envoyé
-- au serveur). Ici on ne stocke que du texte chiffré, illisible côté serveur.
-- Sécurité : RLS activée SANS aucune policy + aucun droit direct => la table n'est accessible que par les 3 fonctions ci-dessous.

create table if not exists public.shares (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  data       text not null check (char_length(data) between 1 and 8500000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index if not exists shares_owner_idx   on public.shares (owner_id);
create index if not exists shares_expires_idx on public.shares (expires_at);

alter table public.shares enable row level security;
revoke all on public.shares from anon, authenticated;

-- Création : réservée aux utilisateurs connectés (compte anonyme créé à la demande par l'appli).
create or replace function public.create_share(p_data text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid    uuid := auth.uid();
  new_id uuid;
  total  bigint;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  if p_data is null or char_length(p_data) < 1 or char_length(p_data) > 8500000 then
    raise exception 'Partage trop volumineux';
  end if;
  if p_data !~ '^[A-Za-z0-9_-]+$' then raise exception 'Format de partage invalide'; end if;

  delete from public.shares where expires_at < now();   -- nettoyage des partages expirés

  if (select count(*) from public.shares where owner_id = uid) >= 5 then
    raise exception 'Trop de partages actifs (5 maximum) : arrêtez-en un ou attendez son expiration';
  end if;
  select coalesce(sum(char_length(data)), 0) into total from public.shares;
  if total + char_length(p_data) > 300000000 then
    raise exception 'Service de partage saturé, réessayez plus tard';
  end if;

  insert into public.shares (owner_id, data) values (uid, p_data) returning id into new_id;
  return new_id;
end $$;
revoke all on function public.create_share(text) from public, anon;
grant execute on function public.create_share(text) to authenticated;

-- Lecture : par identifiant (UUID aléatoire, impossible à deviner) ; renvoie null si inexistant ou expiré.
create or replace function public.get_share(p_id uuid) returns text
language sql security definer stable set search_path = '' as $$
  select data from public.shares where id = p_id and expires_at > now();
$$;
revoke all on function public.get_share(uuid) from public;
grant execute on function public.get_share(uuid) to anon, authenticated;

-- Révocation : seulement par le propriétaire.
create or replace function public.delete_share(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.shares where id = p_id and owner_id = auth.uid();
$$;
revoke all on function public.delete_share(uuid) from public, anon;
grant execute on function public.delete_share(uuid) to authenticated;
