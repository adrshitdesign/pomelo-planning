import { useMemo, useState } from 'react';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  isWeekend,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
} from 'date-fns';
import { AlertTriangle, CalendarClock, UserX, Timer } from 'lucide-react';
import { Card, Spinner } from '@/components/ui/misc';
import { Select } from '@/components/ui/input';
import {
  useClients,
  useProjectObjects,
  useStatuses,
  useTickets,
  useUsers,
} from '@/hooks/queries';
import { formatDuration } from '@/lib/utils';
import type { Ticket } from '@/lib/types';

/** Heures ouvrées retenues pour une journée pleine. */
const HOURS_PER_DAY = 7;

type Period = 'week' | 'month' | 'quarter';

const PERIOD_LABELS: Record<Period, string> = {
  week: 'Cette semaine',
  month: 'Ce mois-ci',
  quarter: 'Ce trimestre',
};

function periodRange(period: Period): { from: Date; to: Date } {
  const now = new Date();
  if (period === 'week') {
    return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
  }
  if (period === 'month') return { from: startOfMonth(now), to: endOfMonth(now) };
  return { from: startOfQuarter(now), to: endOfQuarter(now) };
}

/**
 * Tableau de bord de pilotage.
 *
 * Quatre questions, dans cet ordre : est-ce qu'on tient nos estimations, qui est
 * surchargé, où part le temps, et qu'est-ce qui traîne.
 */
export function DashboardPage() {
  const [period, setPeriod] = useState<Period>('week');
  const tickets = useTickets({});
  const statuses = useStatuses();
  const users = useUsers();
  const clients = useClients();
  const objects = useProjectObjects();

  const range = useMemo(() => periodRange(period), [period]);

  const finalStatusIds = useMemo(
    () => new Set((statuses.data ?? []).filter((s) => s.isFinal).map((s) => s.id)),
    [statuses.data],
  );

  const all = tickets.data?.items ?? [];

  /** Tickets dont le début tombe dans la période observée. */
  const inPeriod = useMemo(
    () =>
      all.filter((t) => {
        if (!t.startAt) return false;
        const start = new Date(t.startAt);
        return start >= range.from && start <= range.to;
      }),
    [all, range],
  );

  // --- Jours ouvrés de la période, pour le taux d'occupation ----------------
  const workingDays = useMemo(
    () => eachDayOfInterval({ start: range.from, end: range.to }).filter((d) => !isWeekend(d)).length,
    [range],
  );
  const capacityMinutes = workingDays * HOURS_PER_DAY * 60;

  // --- 1. Écart estimé / réel ----------------------------------------------
  const gap = useMemo(() => {
    const build = (key: (t: Ticket) => { id: string; name: string } | null) => {
      const rows = new Map<string, { name: string; estimated: number; actual: number; count: number }>();
      for (const ticket of inPeriod) {
        // Seuls les tickets où le réel a été saisi disent quelque chose.
        if (!ticket.actualMinutes) continue;
        const group = key(ticket);
        if (!group) continue;
        const row = rows.get(group.id) ?? { name: group.name, estimated: 0, actual: 0, count: 0 };
        row.estimated += ticket.estimatedMinutes ?? 0;
        row.actual += ticket.actualMinutes;
        row.count += 1;
        rows.set(group.id, row);
      }
      return [...rows.values()]
        .filter((row) => row.estimated > 0)
        .sort((a, b) => Math.abs(b.actual - b.estimated) - Math.abs(a.actual - a.estimated));
    };

    return {
      byPerson: build((t) =>
        t.assignees[0] ? { id: t.assignees[0].userId, name: t.assignees[0].user.name } : null,
      ),
      byClient: build((t) => (t.client ? { id: t.client.id, name: t.client.name } : null)),
      byObject: build((t) =>
        t.projectObject ? { id: t.projectObject.id, name: t.projectObject.name } : null,
      ),
    };
  }, [inPeriod]);

  const totalEstimated = inPeriod.reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0);
  const totalActual = inPeriod.reduce((sum, t) => sum + (t.actualMinutes ?? 0), 0);

  // --- 2. Occupation par personne ------------------------------------------
  const workload = useMemo(() => {
    return (users.data ?? [])
      .filter((u) => u.isActive)
      .map((user) => {
        const own = inPeriod.filter((t) => t.assignees.some((a) => a.userId === user.id));
        // La durée retenue : le réel quand il existe, sinon l'estimé, sinon la
        // durée posée au planning.
        const minutes = own.reduce((sum, t) => sum + plannedMinutes(t), 0);
        return {
          id: user.id,
          name: user.name,
          minutes,
          count: own.length,
          rate: capacityMinutes > 0 ? minutes / capacityMinutes : 0,
        };
      })
      .filter((row) => row.count > 0 || row.minutes > 0)
      .sort((a, b) => b.rate - a.rate);
  }, [users.data, inPeriod, capacityMinutes]);

  // --- 3. Répartition du temps ---------------------------------------------
  const split = useMemo(() => {
    const build = (key: (t: Ticket) => { id: string; name: string; color?: string } | null) => {
      const rows = new Map<string, { name: string; color?: string; minutes: number }>();
      for (const ticket of inPeriod) {
        const group = key(ticket);
        if (!group) continue;
        const row = rows.get(group.id) ?? { name: group.name, color: group.color, minutes: 0 };
        row.minutes += plannedMinutes(ticket);
        rows.set(group.id, row);
      }
      return [...rows.values()].filter((r) => r.minutes > 0).sort((a, b) => b.minutes - a.minutes);
    };

    return {
      byClient: build((t) => (t.client ? { ...t.client } : null)),
      byObject: build((t) => (t.projectObject ? { ...t.projectObject } : null)),
    };
  }, [inPeriod]);

  // --- 4. Retards et alertes ------------------------------------------------
  const alerts = useMemo(() => {
    const now = new Date();
    const open = all.filter((t) => !finalStatusIds.has(t.statusId));
    return {
      late: open.filter((t) => t.endAt && new Date(t.endAt) < now),
      unassigned: open.filter((t) => t.assignees.length === 0),
      unscheduled: open.filter((t) => !t.startAt),
      doneWithoutTime: all.filter((t) => finalStatusIds.has(t.statusId) && !t.actualMinutes),
    };
  }, [all, finalStatusIds]);

  if (tickets.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const deviation = totalEstimated > 0 ? (totalActual - totalEstimated) / totalEstimated : 0;

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-base font-semibold">Tableau de bord</h1>
        <Select
          className="h-8 w-40"
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          aria-label="Période observée"
        >
          {Object.entries(PERIOD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <span className="text-xs text-muted-foreground">
          {workingDays} jours ouvrés · {inPeriod.length} tâches planifiées
        </span>
      </div>

      {/* Chiffres d'en-tête */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Charge estimée" value={formatDuration(totalEstimated)} />
        <Stat label="Temps réel saisi" value={formatDuration(totalActual)} />
        <Stat
          label="Écart estimé → réel"
          value={totalEstimated > 0 ? formatSigned(deviation) : '—'}
          hint={
            totalEstimated > 0
              ? deviation > 0
                ? 'On dépasse les estimations'
                : 'On tient les estimations'
              : 'Pas encore de temps réel saisi'
          }
          tone={Math.abs(deviation) > 0.15 ? (deviation > 0 ? 'warning' : 'success') : 'neutral'}
        />
        <Stat
          label="À traiter"
          value={String(
            alerts.late.length + alerts.unassigned.length + alerts.unscheduled.length,
          )}
          hint="Retards, non assignées, non planifiées"
          tone={alerts.late.length > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {/* 4. Alertes — en haut parce que ce sont les seules lignes à action */}
      <Card className="mb-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ce qui demande une décision
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Alert
            icon={AlertTriangle}
            label="En retard"
            hint="Échéance passée, pas terminé"
            count={alerts.late.length}
            tone="warning"
          />
          <Alert
            icon={UserX}
            label="Sans personne"
            hint="Aucun assigné"
            count={alerts.unassigned.length}
            tone={alerts.unassigned.length > 0 ? 'warning' : 'neutral'}
          />
          <Alert
            icon={CalendarClock}
            label="Non planifiées"
            hint="Pas de date de début"
            count={alerts.unscheduled.length}
            tone="neutral"
          />
          <Alert
            icon={Timer}
            label="Sans temps réel"
            hint="Terminées, temps non saisi"
            count={alerts.doneWithoutTime.length}
            tone="neutral"
          />
        </div>
        {alerts.late.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-border pt-2">
            {alerts.late.slice(0, 5).map((ticket) => (
              <li key={ticket.id} className="flex gap-2 text-xs">
                <span className="font-medium">#{ticket.reference}</span>
                <span className="truncate">{ticket.title}</span>
                <span className="ml-auto shrink-0 text-muted-foreground">
                  {ticket.client?.name ?? '—'}
                </span>
              </li>
            ))}
            {alerts.late.length > 5 && (
              <li className="text-xs text-muted-foreground">
                et {alerts.late.length - 5} autre{alerts.late.length - 5 > 1 ? 's' : ''}…
              </li>
            )}
          </ul>
        )}
      </Card>

      {/* 2. Occupation */}
      <Card className="mb-4">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Taux d'occupation
          </h2>
          <span className="text-[11px] text-muted-foreground">
            base {HOURS_PER_DAY} h/jour · {formatDuration(capacityMinutes)} sur la période
          </span>
        </div>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Au-delà de 100 %, la personne a plus de travail posé que d'heures disponibles.
        </p>
        <div className="space-y-2">
          {workload.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate text-xs">{row.name}</span>
              <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-r-[4px]"
                  style={{
                    width: `${Math.min(100, row.rate * 100)}%`,
                    backgroundColor:
                      row.rate > 1 ? 'hsl(var(--warning))' : 'hsl(var(--category-1))',
                  }}
                />
                {/* Repère des 100 % */}
                <span className="absolute inset-y-0 right-0 w-px bg-border" />
              </div>
              <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {formatDuration(row.minutes)}
              </span>
              <span
                className={`w-12 shrink-0 text-right text-xs font-medium tabular-nums ${
                  row.rate > 1 ? 'text-warning' : 'text-foreground'
                }`}
              >
                {Math.round(row.rate * 100)} %
              </span>
            </div>
          ))}
          {workload.length === 0 && (
            <p className="text-xs text-muted-foreground">Rien de planifié sur cette période.</p>
          )}
        </div>
      </Card>

      {/* 1. Écart estimé / réel */}
      <Card className="mb-4">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Estimé face au réel
          </h2>
          {/* Deux séries : légende obligatoire */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full bg-muted-foreground/40" /> estimé
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-4 rounded-full"
                style={{ backgroundColor: 'hsl(var(--category-1))' }}
              />{' '}
              réel
            </span>
          </div>
        </div>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Sur les tâches dont le temps réel a été saisi. Trié par écart décroissant.
        </p>
        <div className="grid gap-5 lg:grid-cols-3">
          <GapBlock title="Par personne" rows={gap.byPerson} />
          <GapBlock title="Par client" rows={gap.byClient} />
          <GapBlock title="Par type de mission" rows={gap.byObject} />
        </div>
      </Card>

      {/* 3. Répartition */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Où part le temps — par client
          </h2>
          <SplitBars rows={split.byClient} empty="Aucun client renseigné sur la période." />
        </Card>
        <Card>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Où part le temps — par type de mission
          </h2>
          <SplitBars rows={split.byObject} empty="Aucun type de mission renseigné." />
        </Card>
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        {(clients.data ?? []).length} clients · {(objects.data ?? []).length} types de mission
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Durée retenue pour une tâche : réel si saisi, sinon estimé, sinon planning. */
function plannedMinutes(ticket: Ticket): number {
  if (ticket.actualMinutes) return ticket.actualMinutes;
  if (ticket.estimatedMinutes) return ticket.estimatedMinutes;
  if (ticket.startAt && ticket.endAt) {
    return Math.max(
      0,
      Math.round((new Date(ticket.endAt).getTime() - new Date(ticket.startAt).getTime()) / 60000),
    );
  }
  return 0;
}

function formatSigned(ratio: number): string {
  const percent = Math.round(ratio * 100);
  return `${percent > 0 ? '+' : ''}${percent} %`;
}

function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'warning' | 'success';
}) {
  return (
    <Card>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${
          tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : ''
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function Alert({
  icon: Icon,
  label,
  hint,
  count,
  tone,
}: {
  icon: typeof AlertTriangle;
  label: string;
  hint: string;
  count: number;
  tone: 'neutral' | 'warning';
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border px-2.5 py-2">
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          tone === 'warning' && count > 0 ? 'text-warning' : 'text-muted-foreground'
        }`}
      />
      <div className="min-w-0">
        <p className="text-xs font-medium">
          {count} · {label}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

/** Barres appariées estimé / réel, avec les valeurs écrites à côté. */
function GapBlock({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; estimated: number; actual: number; count: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.estimated, r.actual)));
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold text-foreground">{title}</h3>
      <div className="space-y-2.5">
        {rows.slice(0, 6).map((row) => {
          const delta = row.estimated > 0 ? (row.actual - row.estimated) / row.estimated : 0;
          return (
            <div key={row.name}>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-xs">{row.name}</span>
                <span
                  className={`shrink-0 text-[11px] font-medium tabular-nums ${
                    delta > 0.15 ? 'text-warning' : delta < -0.15 ? 'text-success' : 'text-muted-foreground'
                  }`}
                >
                  {formatSigned(delta)}
                </span>
              </div>
              <div className="space-y-[2px]">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-r-[4px] bg-muted-foreground/40"
                      style={{ width: `${(row.estimated / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                    {formatDuration(row.estimated)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-r-[4px]"
                      style={{
                        width: `${(row.actual / max) * 100}%`,
                        backgroundColor: 'hsl(var(--category-1))',
                      }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                    {formatDuration(row.actual)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Rien à comparer : aucun temps réel saisi.
          </p>
        )}
      </div>
    </div>
  );
}

/** Une seule série : pas de légende, la valeur est écrite au bout. */
function SplitBars({
  rows,
  empty,
}: {
  rows: { name: string; color?: string; minutes: number }[];
  empty: string;
}) {
  const total = rows.reduce((sum, r) => sum + r.minutes, 0);
  const max = Math.max(1, ...rows.map((r) => r.minutes));
  return (
    <div className="space-y-2">
      {rows.slice(0, 10).map((row) => (
        <div key={row.name} className="flex items-center gap-2">
          <span className="w-32 shrink-0 truncate text-xs">{row.name}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-r-[4px]"
              style={{
                width: `${(row.minutes / max) * 100}%`,
                backgroundColor: row.color ?? 'hsl(var(--category-1))',
              }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {formatDuration(row.minutes)}
          </span>
          <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
            {total > 0 ? `${Math.round((row.minutes / total) * 100)} %` : '—'}
          </span>
        </div>
      ))}
      {rows.length === 0 && <p className="text-xs text-muted-foreground">{empty}</p>}
    </div>
  );
}
