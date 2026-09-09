-- ===========================================================================
-- Mise à jour 001 — Le client se choisit directement sur un ticket
-- ---------------------------------------------------------------------------
-- Avant : un ticket n'était rattaché qu'à un « objet », et le client se
--         devinait à travers cet objet.
-- Après : le ticket porte son client, et l'objet devient facultatif.
--
-- À coller dans Supabase → SQL Editor → New query → Run.
-- Ce script peut être relancé sans risque : il ne supprime rien.
-- ===========================================================================

-- 1. Nouvelle colonne « client » sur les tickets et sur les événements.
alter table public.tickets
  add column if not exists client_id uuid references public.clients (id) on delete set null;

alter table public.events
  add column if not exists client_id uuid references public.clients (id) on delete set null;

create index if not exists tickets_client_idx on public.tickets (client_id);
create index if not exists events_client_idx on public.events (client_id);

-- 2. Reprise de l'existant : les tickets déjà rattachés à un objet héritent
--    du client de cet objet, pour qu'aucune information ne soit perdue.
update public.tickets t
set client_id = o.client_id
from public.project_objects o
where t.project_object_id = o.id
  and t.client_id is null;

update public.events e
set client_id = o.client_id
from public.project_objects o
where e.project_object_id = o.id
  and e.client_id is null;

-- 3. Garde-fou : si un objet est choisi, il doit appartenir au client du
--    ticket. Empêche « client A » + « objet du client B ».
create or replace function public.sync_client_from_object()
returns trigger language plpgsql as $$
declare
  object_client uuid;
begin
  if new.project_object_id is not null then
    select client_id into object_client
    from public.project_objects
    where id = new.project_object_id;

    -- L'objet fait foi : il porte toujours son client.
    new.client_id := object_client;
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
