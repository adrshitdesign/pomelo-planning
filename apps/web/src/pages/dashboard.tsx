import { useMemo } from 'react';
import { endOfWeek, startOfWeek } from 'date-fns';
import { Card, Spinner } from '@/components/ui/misc';
import { useStatuses, useTickets, useUsers } from '@/hooks/queries';
import { formatDuration } from '@/lib/utils';

/**
 * Tableau de bord — indicateurs de base (phase 2 du brief).
 * Volontairement simple : les statistiques avancées viendront ensuite.
 */
export function DashboardPage() {
  const tickets = useTickets({});
  const statuses = useStatuses();
  const users = useUsers();

  const week = useMemo(() => {
    const now = new Date();
    return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
  }, []);

  const items = tickets.data?.items ?? [];
  const finalStatusIds = new Set(
    (statuses.data ?? []).filter((s) => s.isFinal).map((s) => s.id),
  );

  const stats = {
    total: items.length,
    open: items.filter((t) => !finalStatusIds.has(t.statusId)).length,
    thisWeek: items.filter(
      (t) => t.startAt && new Date(t.startAt) >= week.from && new Date(t.startAt) <= week.to,
    ).length,
    unscheduled: items.filter((t) => !t.startAt).length,
    estimated: items.reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0),
    actual: items.reduce((sum, t) => sum + (t.actualMinutes ?? 0), 0),
  };

  const byStatus = (statuses.data ?? []).map((status) => ({
    status,
    count: items.filter((t) => t.statusId === status.id).length,
  }));

  const byUser = (users.data ?? [])
    .map((user) => ({
      user,
      count: items.filter((t) => t.assignees.some((a) => a.userId === user.id)).length,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  const maxStatus = Math.max(1, ...byStatus.map((row) => row.count));
  const maxUser = Math.max(1, ...byUser.map((row) => row.count));

  if (tickets.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <h1 className="mb-4 text-base font-semibold">Tableau de bord</h1>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Tickets actifs" value={stats.open} />
        <Stat label="Planifiés cette semaine" value={stats.thisWeek} />
        <Stat label="Non planifiés" value={stats.unscheduled} />
        <Stat label="Charge estimée" value={formatDuration(stats.estimated)} />
        <Stat label="Temps réel saisi" value={formatDuration(stats.actual)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Répartition par statut
          </h2>
          <div className="space-y-2">
            {byStatus.map(({ status, count }) => (
              <div key={status.id} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-xs">{status.name}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(count / maxStatus) * 100}%`,
                      backgroundColor: status.color,
                    }}
                  />
                </div>
                <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Charge par personne
          </h2>
          <div className="space-y-2">
            {byUser.map(({ user, count }) => (
              <div key={user.id} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-xs">{user.name}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(count / maxUser) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                  {count}
                </span>
              </div>
            ))}
            {byUser.length === 0 && (
              <p className="text-xs text-muted-foreground">Aucun ticket assigné.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
