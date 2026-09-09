-- ===========================================================================
-- Planning & tickets
-- Base de données Supabase : tables, sécurité, déclencheurs et données de base.
--
-- À exécuter UNE FOIS, en entier, dans Supabase → SQL Editor → New query.
-- Le script est ré-exécutable sans dommage (il ne casse rien s'il tourne deux
-- fois), mais il ne supprime jamais de données existantes.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Personnes, équipes
-- ---------------------------------------------------------------------------

-- Les mots de passe sont gérés par Supabase (table auth.users, hors de portée).
-- `profiles` ne contient que ce que l'application affiche.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null,
  avatar_url text,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#1D4E89',
  description text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  is_lead boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (user_id, team_id)
);

-- ---------------------------------------------------------------------------
-- 2. Rôles et permissions (RBAC)
-- ---------------------------------------------------------------------------

create table if not exists public.permissions (
  key text primary key,
  description text not null
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_system boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  primary key (user_id, role_id)
);

-- ---------------------------------------------------------------------------
-- 3. Clients et objets de projet
-- ---------------------------------------------------------------------------

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_name text,
  email text,
  phone text,
  color text not null default '#F2603C',
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- « object » est un mot réservé : la table s'appelle project_objects.
-- Un objet est un type de mission (calage, montage, contrôle des livrables…).
-- Sans client, il est proposé pour tous les clients ; avec un client, il lui
-- est réservé.
create table if not exists public.project_objects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade,
  name text not null,
  reference text,
  description text,
  color text not null default '#2CA5E0',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, name)
);

-- « unique (client_id, name) » ne joue pas quand client_id est vide.
create unique index if not exists project_objects_nom_commun_idx
  on public.project_objects (name)
  where client_id is null;

-- ---------------------------------------------------------------------------
-- 3 bis. Étiquettes colorées posées sur les tickets
-- ---------------------------------------------------------------------------

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#F2603C',
  description text,
  position integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Statuts personnalisables
-- ---------------------------------------------------------------------------

create table if not exists public.statuses (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  color text not null default '#94a3b8',
  position integer not null default 0,
  is_default boolean not null default false,
  is_final boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. Tickets
-- ---------------------------------------------------------------------------

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  reference bigint generated by default as identity,
  title text not null,
  description text,
  status_id uuid not null references public.statuses (id),
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  color text,
  start_at timestamptz,
  end_at timestamptz,
  estimated_minutes integer,
  actual_minutes integer,
  creator_id uuid references public.profiles (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  -- Le client est porté par le ticket ; l'objet est facultatif et, quand il
  -- est renseigné, c'est lui qui fait foi (voir le déclencheur plus bas).
  client_id uuid references public.clients (id) on delete set null,
  project_object_id uuid references public.project_objects (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_dates_check check (end_at is null or start_at is null or end_at > start_at)
);

create index if not exists tickets_range_idx on public.tickets (start_at, end_at);
create index if not exists tickets_status_idx on public.tickets (status_id);
create index if not exists tickets_archived_idx on public.tickets (archived_at);
create index if not exists tickets_client_idx on public.tickets (client_id);

create table if not exists public.ticket_assignees (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  start_at timestamptz,
  end_at timestamptz,
  assigned_at timestamptz not null default now(),
  unique (ticket_id, user_id)
);

create index if not exists ticket_assignees_user_idx on public.ticket_assignees (user_id, start_at);

create table if not exists public.ticket_labels (
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (ticket_id, label_id)
);

create index if not exists ticket_labels_label_idx on public.ticket_labels (label_id);

-- ---------------------------------------------------------------------------
-- 6. Événements (réunion, congé, formation…)
-- ---------------------------------------------------------------------------

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  type text not null default 'MEETING'
    check (type in ('MEETING', 'LEAVE', 'APPOINTMENT', 'TRAINING', 'OTHER')),
  color text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  is_all_day boolean not null default false,
  location text,
  creator_id uuid references public.profiles (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  project_object_id uuid references public.project_objects (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_dates_check check (end_at > start_at)
);

create index if not exists events_range_idx on public.events (start_at, end_at);
create index if not exists events_client_idx on public.events (client_id);

create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  is_owner boolean not null default false,
  unique (event_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 7. Commentaires, notifications, journal
-- ---------------------------------------------------------------------------

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text not null,
  entity_id uuid not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on public.notifications (recipient_id, read_at);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_entity_idx on public.audit_log (entity_type, entity_id);

-- ===========================================================================
-- 8. Fonctions de sécurité
-- ===========================================================================

-- Liste des permissions de la personne connectée.
create or replace function public.current_permissions()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct rp.permission_key), '{}')
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id and r.archived_at is null
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.profiles p on p.id = ur.user_id
  where ur.user_id = auth.uid()
    and p.is_active
    and p.archived_at is null;
$$;

create or replace function public.has_permission(needed text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select needed = any (public.current_permissions());
$$;

-- Profil complet de la personne connectée, en un seul appel.
create or replace function public.me()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'id', p.id,
    'email', p.email,
    'name', p.name,
    'avatarUrl', p.avatar_url,
    'roles', coalesce(
      (select array_agg(r.key) from public.user_roles ur
       join public.roles r on r.id = ur.role_id where ur.user_id = p.id), '{}'),
    'permissions', public.current_permissions(),
    'teamIds', coalesce(
      (select array_agg(tm.team_id) from public.team_memberships tm
       where tm.user_id = p.id), '{}')
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

-- ===========================================================================
-- 9. Déclencheurs
-- ===========================================================================

-- Création du profil à l'inscription. La toute première personne inscrite
-- devient administrateur ; les suivantes sont lectrices par défaut.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first boolean;
  target_role text;
begin
  select count(*) = 0 into is_first from public.profiles;

  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  target_role := case when is_first then 'admin' else 'reader' end;

  insert into public.user_roles (user_id, role_id)
  select new.id, id from public.roles where key = target_role
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Horodatage de modification.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tickets_touch on public.tickets;
create trigger tickets_touch before update on public.tickets
  for each row execute function public.touch_updated_at();

drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

-- Journal d'audit automatique sur les tickets et les événements.
create or replace function public.write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  action_name text;
  target uuid;
begin
  if tg_op = 'INSERT' then
    action_name := tg_argv[0] || '.created';
    target := new.id;
  elsif tg_op = 'UPDATE' then
    if new.archived_at is not null and old.archived_at is null then
      action_name := tg_argv[0] || '.archived';
    elsif tg_argv[0] = 'ticket' and new.status_id is distinct from old.status_id then
      action_name := 'ticket.status_changed';
    elsif new.start_at is distinct from old.start_at or new.end_at is distinct from old.end_at then
      action_name := tg_argv[0] || '.moved';
    else
      action_name := tg_argv[0] || '.updated';
    end if;
    target := new.id;
  else
    action_name := tg_argv[0] || '.deleted';
    target := old.id;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    action_name,
    upper(tg_argv[0]),
    target,
    case when tg_op = 'UPDATE'
      then jsonb_build_object('from', jsonb_build_object('start_at', old.start_at, 'end_at', old.end_at))
      else null end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists tickets_audit on public.tickets;
create trigger tickets_audit after insert or update or delete on public.tickets
  for each row execute function public.write_audit('ticket');

drop trigger if exists events_audit on public.events;
create trigger events_audit after insert or update or delete on public.events
  for each row execute function public.write_audit('event');

-- Notification automatique à l'assignation d'un ticket.
create or replace function public.notify_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_title text;
begin
  if new.user_id = auth.uid() then
    return new; -- on ne se notifie pas soi-même
  end if;

  select title into ticket_title from public.tickets where id = new.ticket_id;

  insert into public.notifications (recipient_id, type, title, entity_type, entity_id)
  values (new.user_id, 'ticket.assigned', 'Ticket assigné : ' || ticket_title, 'TICKET', new.ticket_id);

  return new;
end;
$$;

drop trigger if exists ticket_assignees_notify on public.ticket_assignees;
create trigger ticket_assignees_notify after insert on public.ticket_assignees
  for each row execute function public.notify_assignee();

-- ===========================================================================
-- 10. Sécurité : accès interdit par défaut, ouvert par permission
-- ===========================================================================

alter table public.profiles          enable row level security;
alter table public.teams             enable row level security;
alter table public.team_memberships  enable row level security;
alter table public.permissions       enable row level security;
alter table public.roles             enable row level security;
alter table public.role_permissions  enable row level security;
alter table public.user_roles        enable row level security;
alter table public.clients           enable row level security;
alter table public.project_objects   enable row level security;
alter table public.statuses          enable row level security;
alter table public.tickets           enable row level security;
alter table public.ticket_assignees  enable row level security;
alter table public.events            enable row level security;
alter table public.event_participants enable row level security;
alter table public.comments          enable row level security;
alter table public.notifications     enable row level security;
alter table public.audit_log         enable row level security;
alter table public.labels            enable row level security;
alter table public.ticket_labels     enable row level security;

-- Petit utilitaire pour éviter la répétition à la main.
do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      -- table,               lecture,                écriture
      ('teams',               'team:view',            'team:manage'),
      ('team_memberships',    'team:view',            'team:manage'),
      ('clients',             'client:view',          'client:manage'),
      ('project_objects',     'project_object:view',  'project_object:manage'),
      ('labels',              'label:view',           'label:manage'),
      ('ticket_labels',       'ticket:view',          'ticket:update'),
      ('statuses',            'planning:view',        'status:manage'),
      ('tickets',             'ticket:view',          'ticket:update'),
      ('ticket_assignees',    'ticket:view',          'ticket:assign'),
      ('events',              'event:view',           'event:update'),
      ('event_participants',  'event:view',           'event:update'),
      ('roles',               'planning:view',        'role:manage'),
      ('role_permissions',    'planning:view',        'role:manage'),
      ('user_roles',          'user:view',            'user:manage')
    ) as t(tbl, read_perm, write_perm)
  loop
    execute format('drop policy if exists %I on public.%I', spec.tbl || '_read', spec.tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.has_permission(%L))',
      spec.tbl || '_read', spec.tbl, spec.read_perm);

    execute format('drop policy if exists %I on public.%I', spec.tbl || '_write', spec.tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.has_permission(%L)) with check (public.has_permission(%L))',
      spec.tbl || '_write', spec.tbl, spec.write_perm, spec.write_perm);
  end loop;
end;
$$;

-- Création de tickets : permission dédiée, distincte de la modification.
drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets for insert to authenticated
  with check (public.has_permission('ticket:create'));

drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated
  with check (public.has_permission('event:create'));

-- Déplacement dans le planning : permission dédiée.
drop policy if exists tickets_move on public.tickets;
create policy tickets_move on public.tickets for update to authenticated
  using (public.has_permission('ticket:update') or public.has_permission('planning:move'))
  with check (public.has_permission('ticket:update') or public.has_permission('planning:move'));

-- Profils : chacun voit et modifie le sien ; les autres selon permission.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_permission('user:view'));

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_permission('user:manage'))
  with check (id = auth.uid() or public.has_permission('user:manage'));

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles for insert to authenticated
  with check (public.has_permission('user:manage'));

-- Catalogue des permissions : lisible par tout compte connecté (pour l'écran
-- d'administration), jamais modifiable depuis l'application.
drop policy if exists permissions_read on public.permissions;
create policy permissions_read on public.permissions for select to authenticated using (true);

-- Commentaires : lecture avec la permission, écriture par l'auteur.
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to authenticated
  using (public.has_permission('comment:view'));

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (public.has_permission('comment:create') and author_id = auth.uid());

drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments for update to authenticated
  using (author_id = auth.uid() or public.has_permission('comment:archive'))
  with check (author_id = auth.uid() or public.has_permission('comment:archive'));

-- Notifications : strictement personnelles.
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for select to authenticated
  using (recipient_id = auth.uid());

drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- Journal d'audit : lecture réservée, écriture uniquement par les déclencheurs.
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated
  using (public.has_permission('audit:view'));

-- ===========================================================================
-- 11. Diffusion temps réel
-- ===========================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['tickets', 'ticket_assignees', 'ticket_labels', 'events', 'comments', 'notifications']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- ===========================================================================
-- Cohérence client / objet
-- ---------------------------------------------------------------------------
-- Un ticket porte son client. Si un objet est choisi, c'est le client de cet
-- objet qui l'emporte : impossible d'avoir « client A » avec un objet du
-- « client B ».
-- ===========================================================================

create or replace function public.sync_client_from_object()
returns trigger language plpgsql as $$
declare
  object_client uuid;
begin
  if new.project_object_id is not null then
    select client_id into object_client
    from public.project_objects
    where id = new.project_object_id;

    -- Un type de mission réservé à un client impose ce client. Un type commun
    -- (sans client) ne touche pas au client choisi sur le ticket.
    if object_client is not null then
      new.client_id := object_client;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tickets_sync_client on public.tickets;
create trigger tickets_sync_client
  before insert or update of project_object_id, client_id on public.tickets
  for each row execute function public.sync_client_from_object();

drop trigger if exists events_sync_client on public.events;
create trigger events_sync_client
  before insert or update of project_object_id, client_id on public.events
  for each row execute function public.sync_client_from_object();
