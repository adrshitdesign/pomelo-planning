import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LayoutList, Columns3, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Avatar, Badge, EmptyState, Spinner } from '@/components/ui/misc';
import { TicketSlideOver } from '@/features/tickets/ticket-slide-over';
import { QuickCreateModal, type QuickCreateContext } from '@/features/planning/quick-create';
import {
  useClients,
  useProjectObjects,
  useStatuses,
  useTeams,
  useTicketMutations,
  useTickets,
  useUsers,
  type TicketFilters,
} from '@/hooks/queries';
import { useAuth } from '@/store/auth';
import { P } from '@/lib/permissions';
import { PRIORITY_LABELS, cn, categoryColor } from '@/lib/utils';
import type { Ticket } from '@/lib/types';

export function TicketsPage() {
  const { can } = useAuth();
  const [mode, setMode] = useState<'list' | 'kanban'>('list');
  const [filters, setFilters] = useState<TicketFilters>({});
  const [search, setSearch] = useState('');
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [quickCreate, setQuickCreate] = useState<QuickCreateContext | null>(null);

  const statuses = useStatuses();
  const users = useUsers();
  const teams = useTeams();
  const clients = useClients();
  const projectObjects = useProjectObjects();
  const mutations = useTicketMutations();

  const query = useMemo(() => ({ ...filters, search: search || undefined }), [filters, search]);
  const tickets = useTickets(query);

  const byStatus = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    for (const status of statuses.data ?? []) map.set(status.id, []);
    for (const ticket of tickets.data?.items ?? []) {
      map.set(ticket.statusId, [...(map.get(ticket.statusId) ?? []), ticket]);
    }
    return map;
  }, [tickets.data, statuses.data]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2">
        <div className="flex overflow-hidden rounded-md border border-border">
          <button
            onClick={() => setMode('list')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs',
              mode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-muted',
            )}
          >
            <LayoutList className="h-3.5 w-3.5" /> Liste
          </button>
          <button
            onClick={() => setMode('kanban')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs',
              mode === 'kanban' ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-muted',
            )}
          >
            <Columns3 className="h-3.5 w-3.5" /> Kanban
          </button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 w-56 pl-7"
            placeholder="Rechercher un ticket…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select
          className="h-8 w-36"
          value={filters.teamId ?? ''}
          onChange={(e) => setFilters({ ...filters, teamId: e.target.value || undefined })}
        >
          <option value="">Toutes les équipes</option>
          {(teams.data ?? []).map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>

        <Select
          className="h-8 w-36"
          value={filters.clientId ?? ''}
          onChange={(e) => setFilters({ ...filters, clientId: e.target.value || undefined })}
        >
          <option value="">Tous les clients</option>
          {(clients.data ?? []).map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>

        <Select
          className="h-8 w-36"
          value={filters.projectObjectId ?? ''}
          onChange={(e) => setFilters({ ...filters, projectObjectId: e.target.value || undefined })}
        >
          <option value="">Tous les objets</option>
          {(projectObjects.data ?? []).map((object) => (
            <option key={object.id} value={object.id}>
              {object.name}
            </option>
          ))}
        </Select>

        <Select
          className="h-8 w-32"
          value={filters.priority ?? ''}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value || undefined })}
        >
          <option value="">Priorité</option>
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={filters.includeArchived ?? false}
            onChange={(e) => setFilters({ ...filters, includeArchived: e.target.checked })}
          />
          Archivés
        </label>

        {can(P.TICKET_CREATE) && (
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => setQuickCreate({ date: defaultSlot() })}
          >
            <Plus className="h-4 w-4" /> Nouveau ticket
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {tickets.isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (tickets.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="Aucun ticket" hint="Ajustez les filtres ou créez un ticket." />
        ) : mode === 'list' ? (
          <TicketTable tickets={tickets.data!.items} onOpen={setOpenTicketId} />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {(statuses.data ?? []).map((status) => (
              <div key={status.id} className="w-72 shrink-0">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  <h3 className="text-xs font-semibold">{status.name}</h3>
                  <span className="text-[11px] text-muted-foreground">
                    {byStatus.get(status.id)?.length ?? 0}
                  </span>
                </div>
                <div className="space-y-2">
                  {(byStatus.get(status.id) ?? []).map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => setOpenTicketId(ticket.id)}
                      className="planning-item planning-item--ticket w-full p-2 text-left hover:bg-surface-muted"
                      style={{
                        ['--item-color' as string]:
                          ticket.projectObject?.color ?? categoryColor(ticket.projectObjectId),
                      }}
                    >
                      <p className="text-xs font-medium leading-tight">{ticket.title}</p>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {ticket.projectObject
                          ? `${ticket.projectObject.client.name} · ${ticket.projectObject.name}`
                          : 'Sans objet'}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1">
                        <Badge>{PRIORITY_LABELS[ticket.priority]}</Badge>
                        <div className="ml-auto flex -space-x-1.5">
                          {ticket.assignees.slice(0, 3).map((a) => (
                            <Avatar key={a.id} name={a.user.name} url={a.user.avatarUrl} size={18} />
                          ))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <QuickCreateModal
        context={quickCreate}
        statuses={statuses.data ?? []}
        users={users.data ?? []}
        teams={teams.data ?? []}
        projectObjects={projectObjects.data ?? []}
        onClose={() => setQuickCreate(null)}
        onSubmit={async (payload, openDetail) => {
          const { __kind, ...body } = payload as { __kind: string } & Record<string, unknown>;
          if (__kind !== 'ticket') return;
          const created = await mutations.create.mutateAsync(body);
          if (openDetail) setOpenTicketId(created.id);
        }}
      />

      <TicketSlideOver
        ticketId={openTicketId}
        statuses={statuses.data ?? []}
        users={users.data ?? []}
        teams={teams.data ?? []}
        projectObjects={projectObjects.data ?? []}
        onClose={() => setOpenTicketId(null)}
      />
    </div>
  );
}

function TicketTable({
  tickets,
  onOpen,
}: {
  tickets: Ticket[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Titre</th>
            <th className="px-3 py-2 font-medium">Statut</th>
            <th className="px-3 py-2 font-medium">Client / objet</th>
            <th className="px-3 py-2 font-medium">Équipe</th>
            <th className="px-3 py-2 font-medium">Priorité</th>
            <th className="px-3 py-2 font-medium">Créneau</th>
            <th className="px-3 py-2 font-medium">Assignés</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr
              key={ticket.id}
              onClick={() => onOpen(ticket.id)}
              className={cn(
                'cursor-pointer border-t border-border bg-surface hover:bg-surface-muted',
                ticket.archivedAt && 'opacity-50',
              )}
            >
              <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">
                {ticket.reference}
              </td>
              <td className="px-3 py-2">{ticket.title}</td>
              <td className="px-3 py-2">
                <Badge color={ticket.status.color}>{ticket.status.name}</Badge>
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {ticket.projectObject
                  ? `${ticket.projectObject.client.name} · ${ticket.projectObject.name}`
                  : '—'}
              </td>
              <td className="px-3 py-2 text-xs">{ticket.team?.name ?? '—'}</td>
              <td className="px-3 py-2 text-xs">{PRIORITY_LABELS[ticket.priority]}</td>
              <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">
                {ticket.startAt
                  ? format(new Date(ticket.startAt), 'd MMM HH:mm', { locale: fr })
                  : 'Non planifié'}
              </td>
              <td className="px-3 py-2">
                <div className="flex -space-x-1.5">
                  {ticket.assignees.map((a) => (
                    <Avatar key={a.id} name={a.user.name} url={a.user.avatarUrl} size={20} />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function defaultSlot() {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  return date;
}
