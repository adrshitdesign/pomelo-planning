import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/lib/api';
import { Avatar, Card, EmptyState, Spinner } from '@/components/ui/misc';
import { useTeams } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import type { PlanningPayload, Team, UserSummary } from '@/lib/types';

interface TeamWithMembers extends Team {
  memberships: { id: string; isLead: boolean; user: UserSummary }[];
  _count?: { tickets: number };
}

export function TeamsPage() {
  const teams = useTeams() as unknown as { data?: TeamWithMembers[]; isLoading: boolean };
  const [selectedId, setSelected] = useState<string | null>(null);
  const selected = teams.data?.find((t) => t.id === selectedId) ?? teams.data?.[0];

  const range = useMemo(() => {
    const now = new Date();
    return {
      from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
      to: endOfWeek(now, { weekStartsOn: 1 }).toISOString(),
    };
  }, []);

  const planning = useQuery({
    queryKey: ['team-planning', selected?.id, range],
    queryFn: () => api.get<PlanningPayload>('/planning', { ...range, teamId: selected?.id }),
    enabled: Boolean(selected?.id),
  });

  return (
    <div className="flex h-full">
      <div className="w-56 shrink-0 overflow-y-auto border-r border-border bg-surface py-2">
        <h2 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Équipes
        </h2>
        {teams.isLoading && <Spinner className="mx-3" />}
        {(teams.data ?? []).map((team) => (
          <button
            key={team.id}
            onClick={() => setSelected(team.id)}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted',
              selected?.id === team.id && 'bg-primary-soft font-medium text-primary',
            )}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: team.color }} />
            <span className="truncate">{team.name}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {team.memberships?.length ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {!selected ? (
          <EmptyState title="Aucune équipe" />
        ) : (
          <>
            <h1 className="mb-4 text-base font-semibold">{selected.name}</h1>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Membres
                </h2>
                <div className="space-y-1.5">
                  {(selected.memberships ?? []).map((membership) => (
                    <div key={membership.id} className="flex items-center gap-2">
                      <Avatar
                        name={membership.user.name}
                        url={membership.user.avatarUrl}
                        size={24}
                      />
                      <span className="text-sm">{membership.user.name}</span>
                      {membership.isLead && (
                        <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] text-primary">
                          Référent
                        </span>
                      )}
                    </div>
                  ))}
                  {(selected.memberships ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">Aucun membre.</p>
                  )}
                </div>
              </Card>

              <Card>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Planning de la semaine
                </h2>
                {planning.isLoading ? (
                  <Spinner />
                ) : (
                  <div className="space-y-1">
                    {(planning.data?.tickets ?? []).slice(0, 12).map((ticket) => (
                      <div
                        key={ticket.id}
                        className="planning-item planning-item--ticket px-2 py-1"
                        style={{ ['--item-color' as string]: ticket.status.color }}
                      >
                        <p className="truncate text-xs">{ticket.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {ticket.startAt
                            ? format(new Date(ticket.startAt), "EEE d 'à' HH:mm", { locale: fr })
                            : 'Non planifié'}
                        </p>
                      </div>
                    ))}
                    {(planning.data?.events ?? []).slice(0, 6).map((event) => (
                      <div
                        key={event.id}
                        className="planning-item planning-item--event px-2 py-1"
                        style={{ ['--item-color' as string]: 'hsl(var(--accent))' }}
                      >
                        <p className="truncate text-xs">{event.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(event.startAt), "EEE d 'à' HH:mm", { locale: fr })}
                        </p>
                      </div>
                    ))}
                    {(planning.data?.tickets.length ?? 0) === 0 &&
                      (planning.data?.events.length ?? 0) === 0 && (
                        <p className="text-xs text-muted-foreground">Rien de planifié cette semaine.</p>
                      )}
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
