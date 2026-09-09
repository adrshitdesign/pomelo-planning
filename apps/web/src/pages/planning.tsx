import { useMemo, useRef, useState } from 'react';
import { addDays, addMonths } from 'date-fns';
import { Spinner, SyncIndicator } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { PlanningBoard, type DropResult } from '@/features/planning/planning-board';
import { PlanningToolbar, type PlanningFilters } from '@/features/planning/planning-toolbar';
import { ItemContextMenu, type ContextMenuState } from '@/features/planning/item-context-menu';
import { QuickCreateModal, type QuickCreateContext } from '@/features/planning/quick-create';
import { TicketSlideOver } from '@/features/tickets/ticket-slide-over';
import {
  computeRange,
  toItems,
  type GroupMode,
  type PlanningItem,
  type PlanningView,
} from '@/features/planning/planning-utils';
import {
  useClients,
  useEventMutations,
  useMoveTicket,
  usePlanning,
  useProjectObjects,
  useStatuses,
  useTeams,
  useTicketMutations,
  useUsers,
} from '@/hooks/queries';
import { useHotkeys } from '@/hooks/use-hotkeys';
import { useAuth } from '@/store/auth';
import { P } from '@/lib/permissions';

export function PlanningPage() {
  const { can } = useAuth();
  const toast = useToast();

  const [view, setView] = useState<PlanningView>('week');
  const [groupMode, setGroupMode] = useState<GroupMode>('person');
  const [anchor, setAnchor] = useState(new Date());
  const [filters, setFilters] = useState<PlanningFilters>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [quickCreate, setQuickCreate] = useState<QuickCreateContext | null>(null);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);

  const range = useMemo(() => computeRange(view, anchor), [view, anchor]);
  const params = useMemo(
    () => ({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      teamId: filters.teamId,
      userId: filters.userId,
      clientId: filters.clientId,
    }),
    [range.from, range.to, filters],
  );

  const planning = usePlanning(params);
  const statuses = useStatuses();
  const users = useUsers();
  const teams = useTeams();
  const clients = useClients();
  const projectObjects = useProjectObjects();

  const move = useMoveTicket(params);
  const tickets = useTicketMutations();
  const events = useEventMutations();

  /** Dernier déplacement, pour l'annulation au clavier ou via le toast. */
  const lastMove = useRef<{ id: string; startAt: string; endAt: string } | null>(null);

  const canMove = can(P.PLANNING_MOVE);
  const canCreate = can(P.TICKET_CREATE);

  const items = useMemo(
    () => toItems(planning.data?.tickets ?? [], planning.data?.events ?? []),
    [planning.data],
  );

  const syncState: 'idle' | 'saving' | 'error' = move.isPending
    ? 'saving'
    : move.isError
      ? 'error'
      : 'idle';

  // --- Actions -------------------------------------------------------------

  const undoLastMove = () => {
    const previous = lastMove.current;
    if (!previous) return toast.push('Rien à annuler');
    move.mutate({ id: previous.id, startAt: previous.startAt, endAt: previous.endAt });
    lastMove.current = null;
  };

  const handleDrop = (result: DropResult) => {
    const { item, startAt, endAt, resourceId, previousResourceId, duplicate } = result;

    if (item.kind === 'event') {
      events.update.mutate({
        id: item.id,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      });
      return;
    }

    // Ctrl/Cmd + glisser → duplication (brief section 8).
    if (duplicate) {
      tickets.duplicate.mutate(
        { id: item.id, startAt: startAt.toISOString() },
        { onSuccess: () => toast.push('Tâche dupliquée', { tone: 'success' }) },
      );
      return;
    }

    lastMove.current = {
      id: item.id,
      startAt: item.startAt.toISOString(),
      endAt: item.endAt.toISOString(),
    };

    move.mutate(
      {
        id: item.id,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        assigneeId: resourceId,
        previousAssigneeId: previousResourceId,
      },
      {
        onError: (error) =>
          toast.push(error instanceof Error ? error.message : 'Déplacement refusé', {
            tone: 'error',
          }),
        onSuccess: () =>
          toast.push('Tâche déplacée', { action: { label: 'Annuler', onClick: undoLastMove } }),
      },
    );
  };

  const handleResize = (item: PlanningItem, endAt: Date) => {
    if (item.kind === 'event') {
      events.update.mutate({ id: item.id, endAt: endAt.toISOString() });
      return;
    }
    lastMove.current = {
      id: item.id,
      startAt: item.startAt.toISOString(),
      endAt: item.endAt.toISOString(),
    };
    move.mutate({
      id: item.id,
      startAt: item.startAt.toISOString(),
      endAt: endAt.toISOString(),
    });
  };

  const handleQuickCreate = async (payload: Record<string, unknown>, openDetail: boolean) => {
    const { __kind, ...body } = payload as { __kind: 'ticket' | 'event' } & Record<string, unknown>;
    if (__kind === 'event') {
      await events.create.mutateAsync(body);
      toast.push('Événement créé', { tone: 'success' });
      return;
    }
    const created = await tickets.create.mutateAsync(body);
    toast.push('Tâche créée', { tone: 'success' });
    if (openDetail) setOpenTicketId(created.id);
  };

  // --- Raccourcis clavier (brief section 8) --------------------------------

  useHotkeys(
    useMemo(
      () => [
        {
          key: 'n',
          description: 'Nouvelle tâche',
          handler: () => canCreate && setQuickCreate({ date: defaultSlot(anchor) }),
        },
        { key: 't', description: "Revenir à aujourd'hui", handler: () => setAnchor(new Date()) },
        {
          key: 'arrowleft',
          description: 'Période précédente',
          handler: () => setAnchor((d) => stepDate(d, view, -1)),
        },
        {
          key: 'arrowright',
          description: 'Période suivante',
          handler: () => setAnchor((d) => stepDate(d, view, 1)),
        },
        { key: 'z', ctrl: true, description: 'Annuler le dernier déplacement', handler: undoLastMove },
        { key: '1', description: 'Vue jour', handler: () => setView('day') },
        { key: '2', description: 'Vue semaine', handler: () => setView('week') },
        { key: '3', description: 'Vue mois', handler: () => setView('month') },
      ],
      [anchor, canCreate, view],
    ),
  );

  return (
    <div className="flex h-full flex-col">
      <PlanningToolbar
        view={view}
        groupMode={groupMode}
        anchor={anchor}
        filters={filters}
        teams={teams.data ?? []}
        users={users.data ?? []}
        clients={clients.data ?? []}
        canCreate={canCreate}
        onViewChange={setView}
        onGroupChange={setGroupMode}
        onAnchorChange={setAnchor}
        onFiltersChange={setFilters}
        onCreate={() => setQuickCreate({ date: defaultSlot(anchor) })}
      />

      <div className="flex items-center justify-between px-4 py-1 text-[11px] text-muted-foreground">
        <span>
          Glisser pour déplacer · bord bas pour la durée · ⌥ Alt (ou Ctrl) + glisser pour dupliquer ·
          N nouvelle tâche · T aujourd'hui · Ctrl+Z annuler
        </span>
        <SyncIndicator state={syncState} />
      </div>

      <div className="min-h-0 flex-1 border-t border-border">
        {planning.isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <PlanningBoard
            view={view}
            groupMode={groupMode}
            anchor={anchor}
            days={range.days}
            items={items}
            resources={planning.data?.resources ?? []}
            teams={teams.data ?? []}
            readOnly={!canMove}
            onDrop={handleDrop}
            onResize={handleResize}
            onOpen={(item) => item.kind === 'ticket' && setOpenTicketId(item.id)}
            onContextMenu={(item, position) =>
              setContextMenu({ item, x: position.x, y: position.y })
            }
            onEmptySlotClick={(date, resourceId) =>
              canCreate && setQuickCreate({ date, resourceId })
            }
          />
        )}
      </div>

      {contextMenu && (
        <ItemContextMenu
          state={contextMenu}
          statuses={statuses.data ?? []}
          canEdit={can(P.TICKET_UPDATE)}
          onClose={() => setContextMenu(null)}
          onOpen={(item) => {
            if (item.kind === 'ticket') setOpenTicketId(item.id);
            setContextMenu(null);
          }}
          onDuplicate={(item) => {
            tickets.duplicate.mutate({ id: item.id });
            setContextMenu(null);
          }}
          onStatusChange={(item, statusId) => {
            tickets.update.mutate({ id: item.id, statusId });
            setContextMenu(null);
          }}
          onAssign={(item) => {
            setOpenTicketId(item.id);
            setContextMenu(null);
          }}
          onHistory={(item) => {
            setOpenTicketId(item.id);
            setContextMenu(null);
          }}
          onArchive={(item) => {
            if (item.kind === 'ticket') tickets.archive.mutate(item.id);
            else events.archive.mutate(item.id);
            setContextMenu(null);
          }}
        />
      )}

      <QuickCreateModal
        context={quickCreate}
        statuses={statuses.data ?? []}
        users={users.data ?? []}
        teams={teams.data ?? []}
        clients={clients.data ?? []}
        projectObjects={projectObjects.data ?? []}
        onClose={() => setQuickCreate(null)}
        onSubmit={handleQuickCreate}
      />

      <TicketSlideOver
        ticketId={openTicketId}
        statuses={statuses.data ?? []}
        users={users.data ?? []}
        teams={teams.data ?? []}
        clients={clients.data ?? []}
        projectObjects={projectObjects.data ?? []}
        onClose={() => setOpenTicketId(null)}
      />
    </div>
  );
}

function stepDate(date: Date, view: PlanningView, direction: 1 | -1) {
  if (view === 'month') return addMonths(date, direction);
  return addDays(date, direction * (view === 'week' ? 7 : 1));
}

function defaultSlot(anchor: Date) {
  const date = new Date(anchor);
  date.setHours(9, 0, 0, 0);
  return date;
}
