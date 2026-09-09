-- ===========================================================================
-- Mise à jour 002 — Types de mission communs + étiquettes colorées
-- ---------------------------------------------------------------------------
-- 1. Un « objet » devient un type de mission (calage, montage, CDL…) partagé
--    par tous les clients. Le rattachement à un client devient facultatif :
--    les objets déjà créés pour un client précis continuent de fonctionner.
-- 2. Les éditeurs peuvent créer des objets et des étiquettes.
-- 3. Nouvelles étiquettes colorées, posées sur les tickets.
--
-- À coller dans Supabase → SQL Editor → New query → Run.
-- Ré-exécutable sans risque : rien n'est supprimé.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Objets partagés par tous les clients
-- ---------------------------------------------------------------------------

alter table public.project_objects alter column client_id drop not null;

-- L'ancienne contrainte « unique (client_id, name) » ne joue plus quand
-- client_id est vide : on ajoute une unicité dédiée aux objets communs.
create unique index if not exists project_objects_nom_commun_idx
  on public.project_objects (name)
  where client_id is null;

-- ---------------------------------------------------------------------------
-- 2. Étiquettes colorées
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

create table if not exists public.ticket_labels (
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (ticket_id, label_id)
);

create index if not exists ticket_labels_label_idx on public.ticket_labels (label_id);

-- ---------------------------------------------------------------------------
-- 3. Permissions
-- ---------------------------------------------------------------------------

insert into public.permissions (key, description) values
  ('label:view',   'Consulter les étiquettes'),
  ('label:manage', 'Créer et modifier les étiquettes')
on conflict (key) do update set description = excluded.description;

-- Tout le monde voit les étiquettes.
insert into public.role_permissions (role_id, permission_key)
select r.id, 'label:view' from public.roles r
where r.key in ('reader', 'editor', 'admin')
on conflict do nothing;

-- Les éditeurs peuvent désormais créer types de mission et étiquettes.
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r, public.permissions p
where r.key = 'editor'
  and p.key in ('project_object:manage', 'label:manage', 'client:manage')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r, public.permissions p
where r.key = 'admin'
  and p.key in ('label:view', 'label:manage')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 4. Sécurité des nouvelles tables
-- ---------------------------------------------------------------------------

alter table public.labels        enable row level security;
alter table public.ticket_labels enable row level security;

drop policy if exists labels_read on public.labels;
create policy labels_read on public.labels for select to authenticated
  using (public.has_permission('label:view'));

drop policy if exists labels_write on public.labels;
create policy labels_write on public.labels for all to authenticated
  using (public.has_permission('label:manage'))
  with check (public.has_permission('label:manage'));

-- Poser ou retirer une étiquette sur un ticket relève de la modification du
-- ticket, pas de la gestion du catalogue d'étiquettes.
drop policy if exists ticket_labels_read on public.ticket_labels;
create policy ticket_labels_read on public.ticket_labels for select to authenticated
  using (public.has_permission('ticket:view'));

drop policy if exists ticket_labels_write on public.ticket_labels;
create policy ticket_labels_write on public.ticket_labels for all to authenticated
  using (public.has_permission('ticket:update'))
  with check (public.has_permission('ticket:update'));

-- ---------------------------------------------------------------------------
-- 5. Étiquettes de départ (modifiables et supprimables depuis l'application)
-- ---------------------------------------------------------------------------

insert into public.labels (name, color, description, position) values
  ('Urgent client',  '#EF4444', 'Demande à traiter en priorité absolue',        0),
  ('Relecture',      '#F59E0B', 'En attente d''une relecture ou d''un retour',  1),
  ('À refacturer',   '#7C3AED', 'Temps à refacturer au client',                 2),
  ('Interne',        '#64748B', 'Travail interne, non facturable',              3)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Types de mission de départ (communs à tous les clients)
-- ---------------------------------------------------------------------------

insert into public.project_objects (client_id, name, color) values
  (null, 'Calage',                '#1D4E89'),
  (null, 'Montage',               '#2CA5E0'),
  (null, 'Contrôle des livrables','#2F9E68'),
  (null, 'Corrections',           '#F59E0B'),
  (null, 'Exécution',             '#7C3AED')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 7. Temps réel diffusé en direct comme le reste
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ticket_labels'
  ) then
    execute 'alter publication supabase_realtime add table public.ticket_labels';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Correction du déclencheur client/objet
-- ---------------------------------------------------------------------------
-- Un type de mission commun n'appartient à aucun client : il ne doit pas
-- effacer le client choisi sur le ticket.

create or replace function public.sync_client_from_object()
returns trigger language plpgsql as $$
declare
  object_client uuid;
begin
  if new.project_object_id is not null then
    select client_id into object_client
    from public.project_objects
    where id = new.project_object_id;

    if object_client is not null then
      new.client_id := object_client;
    end if;
  end if;
  return new;
end;
$$;
