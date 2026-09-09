export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type EventType = 'MEETING' | 'LEAVE' | 'APPOINTMENT' | 'TRAINING' | 'OTHER';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  sessionId: string;
  roles: string[];
  permissions: string[];
  teamIds: string[];
}

export interface Team {
  id: string;
  name: string;
  color: string;
  description?: string | null;
}

export interface UserSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface User extends UserSummary {
  email: string;
  isActive: boolean;
  archivedAt: string | null;
  roles: { id: string; key: string; name: string }[];
  teams: Team[];
}

export interface Status {
  id: string;
  key: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  isFinal: boolean;
}

export interface Client {
  id: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  color: string;
  notes?: string | null;
  projectObjects?: ProjectObject[];
}

export interface ProjectObject {
  id: string;
  clientId: string;
  name: string;
  reference?: string | null;
  description?: string | null;
  color: string;
  client?: { id: string; name: string; color: string };
  _count?: { tickets: number; events: number };
}

export interface TicketAssignee {
  id: string;
  userId: string;
  startAt: string | null;
  endAt: string | null;
  user: UserSummary;
}

export interface Ticket {
  id: string;
  reference: number;
  title: string;
  description: string | null;
  statusId: string;
  status: Status;
  priority: Priority;
  color: string | null;
  startAt: string | null;
  endAt: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  teamId: string | null;
  team: Team | null;
  /** Le client du ticket. C'est l'information principale ; l'objet est optionnel. */
  clientId: string | null;
  client: { id: string; name: string; color: string } | null;
  projectObjectId: string | null;
  projectObject:
    | (Pick<ProjectObject, 'id' | 'name' | 'color'> & { client: { id: string; name: string; color: string } })
    | null;
  creator: UserSummary;
  assignees: TicketAssignee[];
  archivedAt: string | null;
  comments?: Comment[];
  _count?: { comments: number };
}

export interface PlanningEvent {
  id: string;
  title: string;
  description: string | null;
  type: EventType;
  color: string | null;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  location: string | null;
  teamId: string | null;
  team: Team | null;
  clientId: string | null;
  client: { id: string; name: string; color: string } | null;
  projectObject: { id: string; name: string; client: { id: string; name: string } } | null;
  creator: UserSummary;
  participants: { id: string; userId: string; isOwner: boolean; user: UserSummary }[];
  archivedAt: string | null;
}

export interface Comment {
  id: string;
  ticketId: string;
  body: string;
  createdAt: string;
  author: UserSummary;
}

export interface PlanningResource {
  id: string;
  name: string;
  avatarUrl: string | null;
  teams: Team[];
}

export interface PlanningPayload {
  range: { from: string; to: string };
  resources: PlanningResource[];
  tickets: Ticket[];
  events: PlanningEvent[];
}

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}

export interface Permission {
  id: string;
  key: string;
  description: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string;
  entityId: string;
  readAt: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: string;
  actor: UserSummary | null;
}
