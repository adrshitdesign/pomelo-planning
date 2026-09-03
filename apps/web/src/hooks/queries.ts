import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as data from '@/lib/data';
import type { PlanningPayload, Ticket } from '@/lib/types';

export type { PlanningParams, TicketFilters, MoveInput } from '@/lib/data';

export const keys = {
  planning: (params: Record<string, unknown>) => ['planning', params] as const,
  tickets: (params: Record<string, unknown>) => ['tickets', params] as const,
  ticket: (id: string) => ['ticket', id] as const,
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
  useQuery({ queryKey: keys.statuses(), queryFn: data.fetchStatuses, staleTime: 300_000 });

export const useUsers = () =>
  useQuery({ queryKey: keys.users(), queryFn: data.fetchUsers, staleTime: 300_000 });

export const useTeams = () =>
  useQuery({ queryKey: keys.teams(), queryFn: data.fetchTeams, staleTime: 300_000 });

export const useClients = () => useQuery({ queryKey: keys.clients(), queryFn: data.fetchClients });

export const useProjectObjects = () =>
  useQuery({ queryKey: keys.projectObjects(), queryFn: data.fetchProjectObjects, staleTime: 120_000 });

export const useRoles = () => useQuery({ queryKey: keys.roles(), queryFn: data.fetchRoles });

export const usePermissions = () =>
  useQuery({ queryKey: keys.permissions(), queryFn: data.fetchPermissions, staleTime: 600_000 });

// --- Planning --------------------------------------------------------------

export const usePlanning = (params: data.PlanningParams) =>
  useQuery({
    queryKey: keys.planning(params),
    queryFn: () => data.fetchPlanning(params),
    placeholderData: (previous) => previous,
  });

/**
 * Déplacement optimiste : la carte bouge immédiatement, la base confirme
 * ensuite. En cas de refus, l'état précédent est restauré.
 */
export function useMoveTicket(params: data.PlanningParams) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: data.MoveInput) => data.moveTicket(input),
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
                          (a) =>
                            a.userId !== input.previousAssigneeId && a.userId !== input.assigneeId,
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

export const useTickets = (filters: data.TicketFilters) =>
  useQuery({
    queryKey: keys.tickets(filters),
    queryFn: () => data.fetchTickets(filters),
    placeholderData: (previous) => previous,
  });

export const useTicket = (id: string | null) =>
  useQuery({
    queryKey: keys.ticket(id ?? ''),
    queryFn: () => data.fetchTicket(id as string),
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
      mutationFn: (input: data.TicketInput) => data.createTicket(input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: { id: string } & data.TicketInput) =>
        data.updateTicket(id, input),
      onSuccess: (ticket: Ticket) => {
        qc.setQueryData(keys.ticket(ticket.id), ticket);
        invalidate();
      },
    }),
    duplicate: useMutation({
      mutationFn: ({ id, startAt }: { id: string; startAt?: string }) =>
        data.duplicateTicket(id, startAt),
      onSuccess: invalidate,
    }),
    archive: useMutation({ mutationFn: data.archiveTicket, onSuccess: invalidate }),
    restore: useMutation({ mutationFn: data.restoreTicket, onSuccess: invalidate }),
    comment: useMutation({
      mutationFn: ({ ticketId, body }: { ticketId: string; body: string }) =>
        data.createComment(ticketId, body),
      onSuccess: (_result, variables) => {
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
      mutationFn: (input: data.EventInput) => data.createEvent(input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: { id: string } & data.EventInput) => data.updateEvent(id, input),
      onSuccess: invalidate,
    }),
    archive: useMutation({ mutationFn: data.archiveEvent, onSuccess: invalidate }),
  };
}

// --- Notifications & audit -------------------------------------------------

export const useNotifications = () =>
  useQuery({
    queryKey: keys.notifications(),
    queryFn: data.fetchNotifications,
    refetchInterval: 120_000,
  });

export const useAudit = (params: { entityType?: string; entityId?: string; take?: number }) =>
  useQuery({
    queryKey: keys.audit(params),
    queryFn: () => data.fetchAudit(params),
    enabled: Boolean(params.entityId) || Boolean(params.entityType),
  });
