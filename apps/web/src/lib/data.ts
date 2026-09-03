/**
 * Couche d'accès aux données — tout passe par Supabase.
 *
 * La base parle en `snake_case`, l'interface en `camelCase` : la conversion se
 * fait ici et nulle part ailleurs, pour que les écrans restent inchangés.
 * Aucune vérification de droits n'est faite ici : c'est la base qui refuse ce
 * qui n'est pas autorisé (règles RLS), l'interface se contente de masquer.
 */
import { supabase, unwrap } from './supabase';
import type {
  AuditEntry,
  Client,
  Comment,
  Notification,
  Permission,
  PlanningEvent,
  PlanningPayload,
  ProjectObject,
  Role,
  Status,
  Team,
  Ticket,
  User,
} from './types';

// ---------------------------------------------------------------------------
// Sélections
// ---------------------------------------------------------------------------

const TICKET_SELECT = `
  id, reference, title, description, status_id, priority, color, start_at, end_at,
  estimated_minutes, actual_minutes, team_id, project_object_id, archived_at,
  status:statuses(*),
  team:teams(id, name, color),
  creator:profiles!tickets_creator_id_fkey(id, name, avatar_url),
  project_object:project_objects(id, name, color, client:clients(id, name, color)),
  assignees:ticket_assignees(id, user_id, start_at, end_at, user:profiles(id, name, avatar_url))
`;

const EVENT_SELECT = `
  id, title, description, type, color, start_at, end_at, is_all_day, location,
  team_id, archived_at,
  team:teams(id, name, color),
  creator:profiles!events_creator_id_fkey(id, name, avatar_url),
  project_object:project_objects(id, name, client:clients(id, name)),
  participants:event_participants(id, user_id, is_owner, user:profiles(id, name, avatar_url))
`;

const PROFILE_SELECT = `
  id, name, avatar_url, email, is_active, archived_at,
  user_roles(roles(id, key, name)),
  team_memberships(teams(id, name, color))
`;

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

type Row = Record<string, any>;

const person = (row: Row | null) =>
  row ? { id: row.id, name: row.name, avatarUrl: row.avatar_url ?? null } : null;

function mapTicket(row: Row): Ticket {
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    description: row.description ?? null,
    statusId: row.status_id,
    status: row.status,
    priority: row.priority,
    color: row.color ?? null,
    startAt: row.start_at ?? null,
    endAt: row.end_at ?? null,
    estimatedMinutes: row.estimated_minutes ?? null,
    actualMinutes: row.actual_minutes ?? null,
    teamId: row.team_id ?? null,
    team: row.team ?? null,
    projectObjectId: row.project_object_id ?? null,
    projectObject: row.project_object
      ? {
          id: row.project_object.id,
          name: row.project_object.name,
          color: row.project_object.color ?? null,
          client: row.project_object.client,
        }
      : null,
    creator: person(row.creator) ?? { id: '', name: '—', avatarUrl: null },
    assignees: (row.assignees ?? []).map((a: Row) => ({
      id: a.id,
      userId: a.user_id,
      startAt: a.start_at ?? null,
      endAt: a.end_at ?? null,
      user: person(a.user) ?? { id: a.user_id, name: '—', avatarUrl: null },
    })),
    archivedAt: row.archived_at ?? null,
  } as Ticket;
}

function mapEvent(row: Row): PlanningEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    type: row.type,
    color: row.color ?? null,
    startAt: row.start_at,
    endAt: row.end_at,
    isAllDay: row.is_all_day,
    location: row.location ?? null,
    teamId: row.team_id ?? null,
    team: row.team ?? null,
    projectObject: row.project_object ?? null,
    creator: person(row.creator) ?? { id: '', name: '—', avatarUrl: null },
    participants: (row.participants ?? []).map((p: Row) => ({
      id: p.id,
      userId: p.user_id,
      isOwner: p.is_owner,
      user: person(p.user) ?? { id: p.user_id, name: '—', avatarUrl: null },
    })),
    archivedAt: row.archived_at ?? null,
  };
}

function mapUser(row: Row): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url ?? null,
    isActive: row.is_active,
    archivedAt: row.archived_at ?? null,
    roles: (row.user_roles ?? []).map((ur: Row) => ur.roles).filter(Boolean),
    teams: (row.team_memberships ?? []).map((tm: Row) => tm.teams).filter(Boolean),
  };
}

function mapObject(row: Row): ProjectObject {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    reference: row.reference ?? null,
    description: row.description ?? null,
    color: row.color,
    client: row.client ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Référentiels
// ---------------------------------------------------------------------------

export async function fetchStatuses(): Promise<Status[]> {
  return unwrap(
    await supabase
      .from('statuses')
      .select('*')
      .is('archived_at', null)
      .order('position', { ascending: true }),
  );
}

export async function fetchUsers(): Promise<User[]> {
  const rows = unwrap<Row[]>(
    await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .is('archived_at', null)
      .order('name', { ascending: true }),
  );
  return rows.map(mapUser);
}

export async function fetchTeams(): Promise<Team[]> {
  const rows = unwrap<Row[]>(
    await supabase
      .from('teams')
      .select('id, name, color, description, memberships:team_memberships(id, is_lead, user:profiles(id, name, avatar_url))')
      .is('archived_at', null)
      .order('name', { ascending: true }),
  );
  return rows.map((row) => ({
    ...row,
    memberships: (row.memberships ?? []).map((m: Row) => ({
      id: m.id,
      isLead: m.is_lead,
      user: person(m.user),
    })),
  })) as unknown as Team[];
}

export async function fetchClients(): Promise<Client[]> {
  const rows = unwrap<Row[]>(
    await supabase
      .from('clients')
      .select('*, project_objects(*)')
      .is('archived_at', null)
      .order('name', { ascending: true }),
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    contactName: row.contact_name ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    color: row.color,
    notes: row.notes ?? null,
    projectObjects: (row.project_objects ?? [])
      .filter((o: Row) => !o.archived_at)
      .map(mapObject),
  }));
}

export async function fetchProjectObjects(): Promise<ProjectObject[]> {
  const rows = unwrap<Row[]>(
    await supabase
      .from('project_objects')
      .select('*, client:clients(id, name, color)')
      .is('archived_at', null)
      .order('name', { ascending: true }),
  );
  return rows.map(mapObject);
}

export async function fetchRoles(): Promise<Role[]> {
  const rows = unwrap<Row[]>(
    await supabase
      .from('roles')
      .select('id, key, name, description, is_system, role_permissions(permission_key), user_roles(user_id)')
      .is('archived_at', null)
      .order('name', { ascending: true }),
  );
  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description ?? null,
    isSystem: row.is_system,
    userCount: (row.user_roles ?? []).length,
    permissions: (row.role_permissions ?? []).map((rp: Row) => rp.permission_key),
  }));
}

export async function fetchPermissions(): Promise<Permission[]> {
  const rows = unwrap<Row[]>(
    await supabase.from('permissions').select('key, description').order('key'),
  );
  return rows.map((row) => ({ id: row.key, key: row.key, description: row.description }));
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export interface PlanningParams {
  from: string;
  to: string;
  teamId?: string;
  userId?: string;
  clientId?: string;
  projectObjectId?: string;
  [key: string]: string | undefined;
}

export async function fetchPlanning(params: PlanningParams): Promise<PlanningPayload> {
  let ticketQuery = supabase
    .from('tickets')
    .select(TICKET_SELECT)
    .is('archived_at', null)
    .lte('start_at', params.to)
    .gte('end_at', params.from);

  if (params.teamId) ticketQuery = ticketQuery.eq('team_id', params.teamId);
  if (params.projectObjectId) ticketQuery = ticketQuery.eq('project_object_id', params.projectObjectId);

  let eventQuery = supabase
    .from('events')
    .select(EVENT_SELECT)
    .is('archived_at', null)
    .lte('start_at', params.to)
    .gte('end_at', params.from);

  if (params.teamId) eventQuery = eventQuery.eq('team_id', params.teamId);

  let profileQuery = supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .is('archived_at', null)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (params.userId) profileQuery = profileQuery.eq('id', params.userId);

  const [ticketRows, eventRows, profileRows] = await Promise.all([
    ticketQuery.then((r) => unwrap<Row[]>(r)),
    eventQuery.then((r) => unwrap<Row[]>(r)),
    profileQuery.then((r) => unwrap<Row[]>(r)),
  ]);

  let tickets = ticketRows.map(mapTicket);
  let events = eventRows.map(mapEvent);

  // Filtres qui portent sur des tables liées : appliqués après lecture, le
  // volume d'une plage de planning restant petit.
  if (params.clientId) {
    tickets = tickets.filter((t) => t.projectObject?.client.id === params.clientId);
    events = events.filter((e) => e.projectObject?.client.id === params.clientId);
  }
  if (params.userId) {
    tickets = tickets.filter((t) => t.assignees.some((a) => a.userId === params.userId));
    events = events.filter((e) => e.participants.some((p) => p.userId === params.userId));
  }

  const users = profileRows.map(mapUser);
  const resources = users
    .filter((u) => !params.teamId || u.teams.some((t) => t.id === params.teamId))
    .map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl, teams: u.teams }));

  return { range: { from: params.from, to: params.to }, resources, tickets, events };
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export interface TicketFilters {
  search?: string;
  statusId?: string;
  teamId?: string;
  clientId?: string;
  projectObjectId?: string;
  assigneeId?: string;
  priority?: string;
  includeArchived?: boolean;
  [key: string]: string | boolean | undefined;
}

export async function fetchTickets(filters: TicketFilters): Promise<{ items: Ticket[]; total: number }> {
  let query = supabase.from('tickets').select(TICKET_SELECT).limit(500);

  if (!filters.includeArchived) query = query.is('archived_at', null);
  if (filters.statusId) query = query.eq('status_id', filters.statusId);
  if (filters.teamId) query = query.eq('team_id', filters.teamId);
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.projectObjectId) query = query.eq('project_object_id', filters.projectObjectId);
  if (filters.search) {
    const term = filters.search.replace(/[%,]/g, ' ');
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const rows = unwrap<Row[]>(await query.order('start_at', { ascending: true, nullsFirst: false }));
  let items = rows.map(mapTicket);

  if (filters.clientId) items = items.filter((t) => t.projectObject?.client.id === filters.clientId);
  if (filters.assigneeId) {
    items = items.filter((t) => t.assignees.some((a) => a.userId === filters.assigneeId));
  }

  return { items, total: items.length };
}

export async function fetchTicket(id: string): Promise<Ticket> {
  const row = unwrap<Row>(await supabase.from('tickets').select(TICKET_SELECT).eq('id', id).single());
  const comments = unwrap<Row[]>(
    await supabase
      .from('comments')
      .select('id, ticket_id, body, created_at, author:profiles(id, name, avatar_url)')
      .eq('ticket_id', id)
      .is('archived_at', null)
      .order('created_at', { ascending: true }),
  );

  return {
    ...mapTicket(row),
    comments: comments.map((c) => ({
      id: c.id,
      ticketId: c.ticket_id,
      body: c.body,
      createdAt: c.created_at,
      author: person(c.author) ?? { id: '', name: '—', avatarUrl: null },
    })) as Comment[],
  };
}

export interface TicketInput {
  title?: string;
  description?: string;
  statusId?: string;
  priority?: string;
  color?: string;
  startAt?: string;
  endAt?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  teamId?: string;
  projectObjectId?: string;
  assignees?: { userId: string; startAt?: string; endAt?: string }[];
}

/** Traduction camelCase → colonnes, en ignorant ce qui n'est pas fourni. */
function ticketColumns(input: TicketInput): Row {
  const row: Row = {};
  const map: Record<string, string> = {
    title: 'title',
    description: 'description',
    statusId: 'status_id',
    priority: 'priority',
    color: 'color',
    startAt: 'start_at',
    endAt: 'end_at',
    estimatedMinutes: 'estimated_minutes',
    actualMinutes: 'actual_minutes',
    teamId: 'team_id',
    projectObjectId: 'project_object_id',
  };
  for (const [key, column] of Object.entries(map)) {
    const value = (input as Row)[key];
    if (value !== undefined) row[column] = value === '' ? null : value;
  }
  return row;
}

async function replaceAssignees(ticketId: string, assignees: TicketInput['assignees']) {
  if (!assignees) return;
  unwrap(await supabase.from('ticket_assignees').delete().eq('ticket_id', ticketId).select('id'));
  if (assignees.length === 0) return;
  unwrap(
    await supabase
      .from('ticket_assignees')
      .insert(
        assignees.map((a) => ({
          ticket_id: ticketId,
          user_id: a.userId,
          start_at: a.startAt ?? null,
          end_at: a.endAt ?? null,
        })),
      )
      .select('id'),
  );
}

export async function createTicket(input: TicketInput): Promise<Ticket> {
  const { data: session } = await supabase.auth.getUser();
  const defaultStatus = input.statusId
    ? null
    : unwrap<Row>(
        await supabase
          .from('statuses')
          .select('id')
          .is('archived_at', null)
          .order('is_default', { ascending: false })
          .order('position', { ascending: true })
          .limit(1)
          .single(),
      );

  const row = unwrap<Row>(
    await supabase
      .from('tickets')
      .insert({
        ...ticketColumns(input),
        status_id: input.statusId ?? defaultStatus?.id,
        creator_id: session.user?.id ?? null,
      })
      .select('id')
      .single(),
  );

  await replaceAssignees(row.id, input.assignees);
  return fetchTicket(row.id);
}

export async function updateTicket(id: string, input: TicketInput): Promise<Ticket> {
  const columns = ticketColumns(input);
  if (Object.keys(columns).length > 0) {
    unwrap(await supabase.from('tickets').update(columns).eq('id', id).select('id'));
  }
  await replaceAssignees(id, input.assignees);
  return fetchTicket(id);
}

export interface MoveInput {
  id: string;
  startAt: string;
  endAt: string;
  assigneeId?: string;
  previousAssigneeId?: string;
}

export async function moveTicket(input: MoveInput): Promise<Ticket> {
  unwrap(
    await supabase
      .from('tickets')
      .update({ start_at: input.startAt, end_at: input.endAt })
      .eq('id', input.id)
      .select('id'),
  );

  if (input.assigneeId) {
    // Glissé sur la ligne d'une autre personne : l'assignation suit.
    if (input.previousAssigneeId && input.previousAssigneeId !== input.assigneeId) {
      unwrap(
        await supabase
          .from('ticket_assignees')
          .delete()
          .eq('ticket_id', input.id)
          .eq('user_id', input.previousAssigneeId)
          .select('id'),
      );
    }
    unwrap(
      await supabase
        .from('ticket_assignees')
        .upsert(
          {
            ticket_id: input.id,
            user_id: input.assigneeId,
            start_at: input.startAt,
            end_at: input.endAt,
          },
          { onConflict: 'ticket_id,user_id' },
        )
        .select('id'),
    );
  } else {
    // Les créneaux propres aux assignés suivent le déplacement global.
    unwrap(
      await supabase
        .from('ticket_assignees')
        .update({ start_at: input.startAt, end_at: input.endAt })
        .eq('ticket_id', input.id)
        .not('start_at', 'is', null)
        .select('id'),
    );
  }

  return fetchTicket(input.id);
}

export async function duplicateTicket(id: string, startAt?: string): Promise<Ticket> {
  const source = await fetchTicket(id);
  const duration =
    source.startAt && source.endAt
      ? new Date(source.endAt).getTime() - new Date(source.startAt).getTime()
      : 3600_000;

  const newStart = startAt ?? source.startAt ?? undefined;
  const newEnd = newStart ? new Date(new Date(newStart).getTime() + duration).toISOString() : undefined;

  return createTicket({
    title: `${source.title} (copie)`,
    description: source.description ?? undefined,
    statusId: source.statusId,
    priority: source.priority,
    color: source.color ?? undefined,
    startAt: newStart,
    endAt: newEnd,
    estimatedMinutes: source.estimatedMinutes ?? undefined,
    teamId: source.teamId ?? undefined,
    projectObjectId: source.projectObjectId ?? undefined,
    assignees: source.assignees.map((a) => ({
      userId: a.userId,
      startAt: a.startAt ? newStart : undefined,
      endAt: a.endAt ? newEnd : undefined,
    })),
  });
}

export async function archiveTicket(id: string): Promise<void> {
  unwrap(
    await supabase
      .from('tickets')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .select('id'),
  );
}

export async function restoreTicket(id: string): Promise<void> {
  unwrap(await supabase.from('tickets').update({ archived_at: null }).eq('id', id).select('id'));
}

export async function createComment(ticketId: string, body: string): Promise<void> {
  const { data: session } = await supabase.auth.getUser();
  unwrap(
    await supabase
      .from('comments')
      .insert({ ticket_id: ticketId, body, author_id: session.user?.id })
      .select('id'),
  );
}

// ---------------------------------------------------------------------------
// Événements
// ---------------------------------------------------------------------------

export interface EventInput {
  title?: string;
  description?: string;
  type?: string;
  color?: string;
  startAt?: string;
  endAt?: string;
  isAllDay?: boolean;
  location?: string;
  teamId?: string;
  projectObjectId?: string;
  participantIds?: string[];
}

function eventColumns(input: EventInput): Row {
  const row: Row = {};
  const map: Record<string, string> = {
    title: 'title',
    description: 'description',
    type: 'type',
    color: 'color',
    startAt: 'start_at',
    endAt: 'end_at',
    isAllDay: 'is_all_day',
    location: 'location',
    teamId: 'team_id',
    projectObjectId: 'project_object_id',
  };
  for (const [key, column] of Object.entries(map)) {
    const value = (input as Row)[key];
    if (value !== undefined) row[column] = value === '' ? null : value;
  }
  return row;
}

export async function createEvent(input: EventInput): Promise<void> {
  const { data: session } = await supabase.auth.getUser();
  const row = unwrap<Row>(
    await supabase
      .from('events')
      .insert({ ...eventColumns(input), creator_id: session.user?.id ?? null })
      .select('id')
      .single(),
  );

  const participants = new Set([...(input.participantIds ?? [])]);
  if (session.user?.id) participants.add(session.user.id);

  unwrap(
    await supabase
      .from('event_participants')
      .insert(
        [...participants].map((userId) => ({
          event_id: row.id,
          user_id: userId,
          is_owner: userId === session.user?.id,
        })),
      )
      .select('id'),
  );
}

export async function updateEvent(id: string, input: EventInput): Promise<void> {
  const columns = eventColumns(input);
  if (Object.keys(columns).length > 0) {
    unwrap(await supabase.from('events').update(columns).eq('id', id).select('id'));
  }
  if (input.participantIds) {
    unwrap(
      await supabase
        .from('event_participants')
        .delete()
        .eq('event_id', id)
        .eq('is_owner', false)
        .select('id'),
    );
    if (input.participantIds.length > 0) {
      unwrap(
        await supabase
          .from('event_participants')
          .upsert(
            input.participantIds.map((userId) => ({ event_id: id, user_id: userId })),
            { onConflict: 'event_id,user_id' },
          )
          .select('id'),
      );
    }
  }
}

export async function archiveEvent(id: string): Promise<void> {
  unwrap(
    await supabase
      .from('events')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .select('id'),
  );
}

// ---------------------------------------------------------------------------
// Notifications & journal
// ---------------------------------------------------------------------------

export async function fetchNotifications(): Promise<{ items: Notification[]; unread: number }> {
  const rows = unwrap<Row[]>(
    await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
  );
  const items = rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body ?? null,
    entityType: row.entity_type,
    entityId: row.entity_id,
    readAt: row.read_at ?? null,
    createdAt: row.created_at,
  }));
  return { items, unread: items.filter((n) => !n.readAt).length };
}

export async function markAllNotificationsRead(): Promise<void> {
  unwrap(
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
      .select('id'),
  );
}

export async function fetchAudit(params: {
  entityType?: string;
  entityId?: string;
  take?: number;
}): Promise<{ items: AuditEntry[]; total: number }> {
  let query = supabase
    .from('audit_log')
    .select('id, action, entity_type, entity_id, metadata, created_at, actor:profiles(id, name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(params.take ?? 50);

  if (params.entityType) query = query.eq('entity_type', params.entityType);
  if (params.entityId) query = query.eq('entity_id', params.entityId);

  const rows = unwrap<Row[]>(await query);
  const items = rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    createdAt: row.created_at,
    actor: person(row.actor),
  })) as AuditEntry[];
  return { items, total: items.length };
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

export async function updateUser(
  id: string,
  input: { isActive?: boolean; roleIds?: string[]; teamIds?: string[]; name?: string },
): Promise<void> {
  const columns: Row = {};
  if (input.isActive !== undefined) columns.is_active = input.isActive;
  if (input.name !== undefined) columns.name = input.name;
  if (Object.keys(columns).length > 0) {
    unwrap(await supabase.from('profiles').update(columns).eq('id', id).select('id'));
  }

  if (input.roleIds) {
    unwrap(await supabase.from('user_roles').delete().eq('user_id', id).select('user_id'));
    if (input.roleIds.length > 0) {
      unwrap(
        await supabase
          .from('user_roles')
          .insert(input.roleIds.map((roleId) => ({ user_id: id, role_id: roleId })))
          .select('user_id'),
      );
    }
  }

  if (input.teamIds) {
    unwrap(await supabase.from('team_memberships').delete().eq('user_id', id).select('id'));
    if (input.teamIds.length > 0) {
      unwrap(
        await supabase
          .from('team_memberships')
          .insert(input.teamIds.map((teamId) => ({ user_id: id, team_id: teamId })))
          .select('id'),
      );
    }
  }
}

export async function updateRolePermissions(roleId: string, permissions: string[]): Promise<void> {
  unwrap(await supabase.from('role_permissions').delete().eq('role_id', roleId).select('role_id'));
  if (permissions.length > 0) {
    unwrap(
      await supabase
        .from('role_permissions')
        .insert(permissions.map((key) => ({ role_id: roleId, permission_key: key })))
        .select('role_id'),
    );
  }
}

export async function createStatus(input: {
  key: string;
  name: string;
  color: string;
  position: number;
}): Promise<void> {
  unwrap(await supabase.from('statuses').insert(input).select('id'));
}

export async function updateStatus(
  id: string,
  input: { name?: string; color?: string; isDefault?: boolean; isFinal?: boolean; position?: number },
): Promise<void> {
  const columns: Row = {};
  if (input.name !== undefined) columns.name = input.name;
  if (input.color !== undefined) columns.color = input.color;
  if (input.position !== undefined) columns.position = input.position;
  if (input.isFinal !== undefined) columns.is_final = input.isFinal;

  if (input.isDefault) {
    // Un seul statut par défaut à la fois.
    unwrap(
      await supabase.from('statuses').update({ is_default: false }).eq('is_default', true).select('id'),
    );
    columns.is_default = true;
  }

  unwrap(await supabase.from('statuses').update(columns).eq('id', id).select('id'));
}

export async function archiveStatus(id: string): Promise<void> {
  const inUse = unwrap<Row[]>(
    await supabase.from('tickets').select('id').eq('status_id', id).is('archived_at', null).limit(1),
  );
  if (inUse.length > 0) throw new Error('Des tickets utilisent encore ce statut');
  unwrap(
    await supabase
      .from('statuses')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .select('id'),
  );
}

export async function createClient(input: {
  name: string;
  contactName?: string;
  email?: string;
}): Promise<void> {
  unwrap(
    await supabase
      .from('clients')
      .insert({ name: input.name, contact_name: input.contactName ?? null, email: input.email ?? null })
      .select('id'),
  );
}

export async function createProjectObject(input: {
  clientId: string;
  name: string;
  reference?: string;
}): Promise<void> {
  unwrap(
    await supabase
      .from('project_objects')
      .insert({ client_id: input.clientId, name: input.name, reference: input.reference ?? null })
      .select('id'),
  );
}
