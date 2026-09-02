import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AuditEntry,
  Client,
  Notification,
  PlanningPayload,
  PlanningEvent,
  ProjectObject,
  Permission,
  Role,
  Status,
  Team,
  Ticket,
  User,
} from '@/lib/types';

export const keys = {
  planning: (params: Record<string, unknown>) => ['planning', params] as const,
  tickets: (params: Record<string, unknown>) => ['tickets', params] as const,
  ticket: (id: string) => ['ticket', id] as const,
  events: (params: Record<string, unknown>) => ['events', params] as const,
  users: () => ['users'] as const,
  teams: () => ['teams'] as const,
  clients: () => ['clients'] as const,
  projectObjects: () => ['project-objects'] as const,
  statuses: () => ['statuses'] as const,
  roles: () => ['roles'] as const,
  permissions: () => ['permissions'] as const,
  notifications: () => ['notifications'] as const,
  audit: (params: Record<string, unknown>) => ['audit', params] as const,
};

// --- Référentiels ----------------------------------------------------------

export const useStatuses = () =>
  useQuery({ queryKey: keys.statuses(), queryFn: () => api.get<Status[]>('/statuses'), staleTime: 300_000 });

export const useUsers = () =>
  useQuery({ queryKey: keys.users(), queryFn: () => api.get<User[]>('/users'), staleTime: 300_000 });

export const useTeams = () =>
  useQuery({ queryKey: keys.teams(), queryFn: () => api.get<Team[]>('/teams'), staleTime: 300_000 });

export const useClients = () =>
  useQuery({ queryKey: keys.clients(), queryFn: () => api.get<Client[]>('/clients') });

export const useProjectObjects = () =>
  useQuery({
    queryKey: keys.projectObjects(),
    queryFn: () => api.get<ProjectObject[]>('/project-objects'),
    staleTime: 120_000,
  });

export const useRoles = () =>
  useQuery({ queryKey: keys.roles(), queryFn: () => api.get<Role[]>('/roles') });

export const usePermissions = () =>
  useQuery({ queryKey: keys.permissions(), queryFn: () => api.get<Permission[]>('/permissions') });

// --- Planning --------------------------------------------------------------

export interface PlanningParams {
  from: string;
  to: string;
  teamId?: string;
  userId?: string;
  clientId?: string;
  projectObjectId?: string;
  [key: string]: string | undefined;
}

export const usePlanning = (params: PlanningParams) =>
  useQuery({
    queryKey: keys.planning(params),
    queryFn: () => api.get<PlanningPayload>('/planning', params),
    placeholderData: (previous) => previous,
  });

export interface MoveInput {
  id: string;
  startAt: string;
  endAt: string;
  assigneeId?: string;
  previousAssigneeId?: string;
}

/**
 * Déplacement optimiste : la carte bouge immédiatement, l'API confirme ensuite.
 * En cas d'échec, TanStack Query restaure l'état précédent.
 */
export function useMoveTicket(params: PlanningParams) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: MoveInput) => api.patch<Ticket>(`/tickets/${id}/move`, body),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: keys.planning(params) });
      const previous = qc.getQueryData<PlanningPayload>(keys.planning(params));

      qc.setQueryData<PlanningPayload>(keys.planning(params), (old) => {
        if (!old) return old;
        return {
          ...old,
          tickets: old.tickets.map((ticket) =>
            ticket.id === input.id
              ? {
                  ...ticket,
                  startAt: input.startAt,
                  endAt: input.endAt,
                  assignees: input.assigneeId
                    ? [
                        ...ticket.assignees.filter(
                          (a) => a.userId !== input.previousAssigneeId && a.userId !== input.assigneeId,
                        ),
                        {
                          id: `optimistic-${input.assigneeId}`,
                          userId: input.assigneeId,
                          startAt: input.startAt,
                          endAt: input.endAt,
                          user: old.resources.find((r) => r.id === input.assigneeId) ?? {
                            id: input.assigneeId,
                            name: '…',
                            avatarUrl: null,
                          },
                        },
                      ]
                    : ticket.assignees,
                }
              : ticket,
          ),
        };
      });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) qc.setQueryData(keys.planning(params), context.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['planning'] });
      void qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

// --- Tickets ---------------------------------------------------------------

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

export const useTickets = (filters: TicketFilters) =>
  useQuery({
    queryKey: keys.tickets(filters),
    queryFn: () => api.get<{ items: Ticket[]; total: number }>('/tickets', filters),
    placeholderData: (previous) => previous,
  });

export const useTicket = (id: string | null) =>
  useQuery({
    queryKey: keys.ticket(id ?? ''),
    queryFn: () => api.get<Ticket>(`/tickets/${id}`),
    enabled: Boolean(id),
  });

export function useTicketMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['planning'] });
    void qc.invalidateQueries({ queryKey: ['tickets'] });
  };

  return {
    create: useMutation({
      mutationFn: (body: Record<string, unknown>) => api.post<Ticket>('/tickets', body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
        api.patch<Ticket>(`/tickets/${id}`, body),
      onSuccess: (ticket) => {
        qc.setQueryData(keys.ticket(ticket.id), ticket);
        invalidate();
      },
    }),
    duplicate: useMutation({
      mutationFn: ({ id, startAt }: { id: string; startAt?: string }) =>
        api.post<Ticket>(`/tickets/${id}/duplicate`, { startAt }),
      onSuccess: invalidate,
    }),
    archive: useMutation({
      mutationFn: (id: string) => api.delete(`/tickets/${id}`),
      onSuccess: invalidate,
    }),
    restore: useMutation({
      mutationFn: (id: string) => api.post(`/tickets/${id}/restore`),
      onSuccess: invalidate,
    }),
    comment: useMutation({
      mutationFn: ({ ticketId, body }: { ticketId: string; body: string }) =>
        api.post(`/tickets/${ticketId}/comments`, { body }),
      onSuccess: (_data, variables) => {
        void qc.invalidateQueries({ queryKey: keys.ticket(variables.ticketId) });
      },
    }),
  };
}

// --- Événements ------------------------------------------------------------

export function useEventMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['planning'] });
    void qc.invalidateQueries({ queryKey: ['events'] });
  };
  return {
    create: useMutation({
      mutationFn: (body: Record<string, unknown>) => api.post<PlanningEvent>('/events', body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
        api.patch<PlanningEvent>(`/events/${id}`, body),
      onSuccess: invalidate,
    }),
    archive: useMutation({
      mutationFn: (id: string) => api.delete(`/events/${id}`),
      onSuccess: invalidate,
    }),
  };
}

// --- Notifications & audit -------------------------------------------------

export const useNotifications = () =>
  useQuery({
    queryKey: keys.notifications(),
    queryFn: () => api.get<{ items: Notification[]; unread: number }>('/notifications'),
    refetchInterval: 120_000,
  });

export const useAudit = (params: { entityType?: string; entityId?: string; take?: number }) =>
  useQuery({
    queryKey: keys.audit(params),
    queryFn: () => api.get<{ items: AuditEntry[]; total: number }>('/audit', params),
    enabled: Boolean(params.entityId) || Boolean(params.entityType),
  });
