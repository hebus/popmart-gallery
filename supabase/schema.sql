-- Pop Mart : échanges / ventes, intérêts et notifications.
-- À exécuter une fois dans Supabase > SQL Editor (le script est rejouable).
-- Prérequis : Authentication > Sign In / Providers > "Allow anonymous sign-ins" activé.
-- Sécurité : la clé anon est publique, TOUT repose sur les règles RLS et les droits de colonnes ci-dessous.

-- ---------------------------------------------------------------- Tables

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  pseudo     text not null unique check (pseudo ~ '^[A-Za-z0-9_.-]{3,20}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.contacts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  value   text not null check (char_length(value) between 1 and 120)
);

create table if not exists public.listings (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  product_id  text not null check (product_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  image_index int  not null check (image_index between 0 and 999),
  kind        text not null check (kind in ('exchange', 'sale')),
  price       numeric(8,2) check (price is null or price between 0 and 99999),
  qty         int  not null default 1 check (qty between 1 and 99),
  note        text check (note is null or char_length(note) <= 140),
  created_at  timestamptz not null default now(),
  unique (owner_id, product_id, image_index),
  check (kind = 'sale' or price is null)
);
create index if not exists listings_created_idx on public.listings (created_at desc);

create table if not exists public.interests (
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);
create index if not exists interests_user_idx on public.interests (user_id);

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  listing_id   uuid not null references public.listings(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  kind         text not null default 'interest' check (kind = 'interest'),
  read         boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (listing_id, from_user_id)
);
create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

-- ---------------------------------------------------------------- Fonctions et triggers

-- Vrai si a et b sont liés par un intérêt (l'un a tagué une annonce de l'autre).
create or replace function public.is_counterpart(a uuid, b uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1
    from public.interests i
    join public.listings l on l.id = i.listing_id
    where (i.user_id = a and l.owner_id = b) or (i.user_id = b and l.owner_id = a)
  );
$$;
revoke all on function public.is_counterpart(uuid, uuid) from public, anon;
grant execute on function public.is_counterpart(uuid, uuid) to authenticated;

create or replace function public.listings_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.listings where owner_id = new.owner_id) >= 200 then
    raise exception 'Limite de 200 annonces atteinte';
  end if;
  return new;
end $$;
drop trigger if exists listings_guard on public.listings;
create trigger listings_guard before insert on public.listings
  for each row execute function public.listings_guard();

create or replace function public.interests_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.listings where id = new.listing_id and owner_id = new.user_id) then
    raise exception 'Impossible de marquer son propre intérêt sur sa propre annonce';
  end if;
  if (select count(*) from public.interests where user_id = new.user_id) >= 100 then
    raise exception 'Limite de 100 intérêts atteinte';
  end if;
  return new;
end $$;
drop trigger if exists interests_guard on public.interests;
create trigger interests_guard before insert on public.interests
  for each row execute function public.interests_guard();

-- Seul ce trigger (security definer) peut créer une notification : les clients ne peuvent pas en forger.
create or replace function public.interests_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (recipient_id, listing_id, from_user_id)
  select l.owner_id, new.listing_id, new.user_id from public.listings l where l.id = new.listing_id
  on conflict (listing_id, from_user_id) do nothing;
  return new;
end $$;
drop trigger if exists interests_notify on public.interests;
create trigger interests_notify after insert on public.interests
  for each row execute function public.interests_notify();

create or replace function public.interests_unnotify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications where listing_id = old.listing_id and from_user_id = old.user_id;
  return old;
end $$;
drop trigger if exists interests_unnotify on public.interests;
create trigger interests_unnotify after delete on public.interests
  for each row execute function public.interests_unnotify();

-- ---------------------------------------------------------------- Droits (moindre privilège)

revoke all on public.profiles, public.contacts, public.listings, public.interests, public.notifications from anon, authenticated;

grant select on public.profiles, public.listings to anon, authenticated;
grant insert (id, pseudo), update (pseudo) on public.profiles to authenticated;

grant select, delete on public.contacts to authenticated;
grant insert (user_id, value), update (value) on public.contacts to authenticated;

grant insert (owner_id, product_id, image_index, kind, price, qty, note) on public.listings to authenticated;
grant update (kind, price, qty, note) on public.listings to authenticated;
grant delete on public.listings to authenticated;

grant select, delete on public.interests to authenticated;
grant insert (listing_id, user_id) on public.interests to authenticated;

grant select, delete on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;

-- ---------------------------------------------------------------- RLS

alter table public.profiles      enable row level security;
alter table public.contacts      enable row level security;
alter table public.listings      enable row level security;
alter table public.interests     enable row level security;
alter table public.notifications enable row level security;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select to anon, authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists contacts_select on public.contacts;
drop policy if exists contacts_insert on public.contacts;
drop policy if exists contacts_update on public.contacts;
drop policy if exists contacts_delete on public.contacts;
create policy contacts_select on public.contacts for select to authenticated
  using (user_id = auth.uid() or public.is_counterpart(auth.uid(), user_id));
create policy contacts_insert on public.contacts for insert to authenticated with check (user_id = auth.uid());
create policy contacts_update on public.contacts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy contacts_delete on public.contacts for delete to authenticated using (user_id = auth.uid());

drop policy if exists listings_select on public.listings;
drop policy if exists listings_insert on public.listings;
drop policy if exists listings_update on public.listings;
drop policy if exists listings_delete on public.listings;
create policy listings_select on public.listings for select to anon, authenticated using (true);
create policy listings_insert on public.listings for insert to authenticated with check (owner_id = auth.uid());
create policy listings_update on public.listings for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy listings_delete on public.listings for delete to authenticated using (owner_id = auth.uid());

drop policy if exists interests_select on public.interests;
drop policy if exists interests_insert on public.interests;
drop policy if exists interests_delete on public.interests;
create policy interests_select on public.interests for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()));
create policy interests_insert on public.interests for insert to authenticated with check (user_id = auth.uid());
create policy interests_delete on public.interests for delete to authenticated using (user_id = auth.uid());

drop policy if exists notifications_select on public.notifications;
drop policy if exists notifications_update on public.notifications;
drop policy if exists notifications_delete on public.notifications;
create policy notifications_select on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated using (recipient_id = auth.uid());

-- ---------------------------------------------------------------- Temps réel (notifications du propriétaire)

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
