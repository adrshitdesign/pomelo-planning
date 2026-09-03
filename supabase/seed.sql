-- ===========================================================================
-- Données de base : permissions, rôles, statuts, équipes.
-- À exécuter APRÈS schema.sql, dans Supabase → SQL Editor.
-- Ré-exécutable sans dommage : rien n'est écrasé ni dupliqué.
-- ===========================================================================

insert into public.permissions (key, description) values
  ('planning:view',          'Consulter le planning'),
  ('planning:move',          'Déplacer / redimensionner dans le planning'),
  ('ticket:view',            'Consulter les tickets'),
  ('ticket:create',          'Créer des tickets'),
  ('ticket:update',          'Modifier des tickets'),
  ('ticket:archive',         'Archiver des tickets'),
  ('ticket:assign',          'Assigner des tickets'),
  ('event:view',             'Consulter les événements'),
  ('event:create',           'Créer des événements'),
  ('event:update',           'Modifier des événements'),
  ('event:archive',          'Archiver des événements'),
  ('comment:view',           'Lire les commentaires'),
  ('comment:create',         'Écrire des commentaires'),
  ('comment:archive',        'Archiver des commentaires'),
  ('client:view',            'Consulter les clients'),
  ('client:manage',          'Gérer les clients'),
  ('project_object:view',    'Consulter les objets'),
  ('project_object:manage',  'Gérer les objets'),
  ('team:view',              'Consulter les équipes'),
  ('team:manage',            'Gérer les équipes'),
  ('user:view',              'Consulter les utilisateurs'),
  ('user:manage',            'Gérer les utilisateurs'),
  ('role:manage',            'Gérer les rôles et permissions'),
  ('status:manage',          'Gérer les statuts personnalisés'),
  ('audit:view',             'Consulter le journal d''audit'),
  ('data:export',            'Exporter les données')
on conflict (key) do update set description = excluded.description;

insert into public.roles (key, name, description, is_system) values
  ('reader', 'Lecteur',        'Consultation du planning et des tickets', true),
  ('editor', 'Éditeur',        'Création et modification des tickets, événements et planning', true),
  ('admin',  'Administrateur', 'Accès complet, y compris administration et exports', true)
on conflict (key) do nothing;

-- Lecteur : tout ce qui est consultation.
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r, public.permissions p
where r.key = 'reader'
  and p.key in ('planning:view', 'ticket:view', 'event:view', 'comment:view',
                'client:view', 'project_object:view', 'team:view', 'user:view')
on conflict do nothing;

-- Éditeur : lecture + production.
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r, public.permissions p
where r.key = 'editor'
  and p.key in ('planning:view', 'planning:move', 'ticket:view', 'ticket:create',
                'ticket:update', 'ticket:archive', 'ticket:assign', 'event:view',
                'event:create', 'event:update', 'event:archive', 'comment:view',
                'comment:create', 'client:view', 'project_object:view',
                'team:view', 'user:view')
on conflict do nothing;

-- Administrateur : tout.
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r, public.permissions p
where r.key = 'admin'
on conflict do nothing;

insert into public.statuses (key, name, color, position, is_default, is_final) values
  ('todo',        'À faire',   '#94a3b8', 0, true,  false),
  ('planned',     'Planifié',  '#2CA5E0', 1, false, false),
  ('in_progress', 'En cours',  '#1D4E89', 2, false, false),
  ('blocked',     'En attente','#F59E0B', 3, false, false),
  ('done',        'Terminé',   '#2F9E68', 4, false, true),
  ('cancelled',   'Annulé',    '#EF4444', 5, false, true)
on conflict (key) do nothing;

insert into public.teams (name, color) values
  ('Direction',     '#6366F1'),
  ('Production',    '#0F9B8E'),
  ('Design',        '#F2603C'),
  ('Développement', '#2CA5E0'),
  ('Commercial',    '#F59E0B')
on conflict (name) do nothing;
