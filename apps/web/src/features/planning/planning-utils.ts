import {
  addDays,
  addMinutes,
  differenceInMinutes,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { PlanningEvent, Ticket } from '@/lib/types';

export type PlanningView = 'day' | 'week' | 'month';
export type GroupMode = 'person' | 'team' | 'company';

/** Amplitude horaire affichée et granularité d'accroche. */
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 19;
export const SLOT_MINUTES = 30;
export const SLOT_HEIGHT = 16; // px pour SLOT_MINUTES — compact, pour voir plusieurs personnes
export const SLOTS_PER_DAY = ((DAY_END_HOUR - DAY_START_HOUR) * 60) / SLOT_MINUTES;

export interface PlanningRange {
  from: Date;
  to: Date;
  days: Date[];
}

export function computeRange(view: PlanningView, anchor: Date): PlanningRange {
  if (view === 'day') {
    return { from: startOfDay(anchor), to: endOfDay(anchor), days: [startOfDay(anchor)] };
  }
  if (view === 'week') {
    const from = startOfWeek(anchor, { weekStartsOn: 1 });
    const to = endOfWeek(anchor, { weekStartsOn: 1 });
    return { from, to, days: Array.from({ length: 7 }, (_, i) => addDays(from, i)) };
  }
  const from = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const to = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  const length = Math.round(differenceInMinutes(to, from) / 1440) + 1;
  return { from, to, days: Array.from({ length }, (_, i) => addDays(from, i)) };
}

/** Position verticale d'une date dans la grille horaire d'une journée. */
export function minutesToOffset(date: Date): number {
  const minutes = (date.getHours() - DAY_START_HOUR) * 60 + date.getMinutes();
  return (minutes / SLOT_MINUTES) * SLOT_HEIGHT;
}

export function durationToHeight(startAt: Date, endAt: Date): number {
  const minutes = Math.max(differenceInMinutes(endAt, startAt), SLOT_MINUTES / 2);
  return (minutes / SLOT_MINUTES) * SLOT_HEIGHT;
}

/** Convertit un déplacement en pixels en minutes accrochées au créneau. */
export function pixelsToSnappedMinutes(deltaY: number): number {
  return Math.round(deltaY / SLOT_HEIGHT) * SLOT_MINUTES;
}

export function slotToDate(day: Date, slotIndex: number): Date {
  return addMinutes(startOfDay(day), DAY_START_HOUR * 60 + slotIndex * SLOT_MINUTES);
}

export interface PlanningItem {
  id: string;
  kind: 'ticket' | 'event';
  title: string;
  startAt: Date;
  endAt: Date;
  color: string;
  statusName?: string;
  statusColor?: string;
  assigneeIds: string[];
  teamIds: string[];
  subtitle?: string;
  raw: Ticket | PlanningEvent;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  MEETING: 'hsl(var(--category-4))',
  LEAVE: 'hsl(var(--category-2))',
  APPOINTMENT: 'hsl(var(--category-5))',
  TRAINING: 'hsl(var(--category-6))',
  OTHER: 'hsl(var(--muted-foreground))',
};

export function toItems(tickets: Ticket[], events: PlanningEvent[]): PlanningItem[] {
  const items: PlanningItem[] = [];

  for (const ticket of tickets) {
    if (!ticket.startAt || !ticket.endAt) continue;
    items.push({
      id: ticket.id,
      kind: 'ticket',
      title: ticket.title,
      startAt: new Date(ticket.startAt),
      endAt: new Date(ticket.endAt),
      // Couleur de catégorie : couleur propre > objet > client > équipe.
      color:
        ticket.color ??
        ticket.projectObject?.color ??
        ticket.projectObject?.client.color ??
        ticket.team?.color ??
        'hsl(var(--primary))',
      statusName: ticket.status?.name,
      statusColor: ticket.status?.color,
      assigneeIds: ticket.assignees.map((a) => a.userId),
      teamIds: ticket.teamId ? [ticket.teamId] : [],
      subtitle: ticket.projectObject
        ? `${ticket.projectObject.client.name} · ${ticket.projectObject.name}`
        : undefined,
      raw: ticket,
    });
  }

  for (const event of events) {
    items.push({
      id: event.id,
      kind: 'event',
      title: event.title,
      startAt: new Date(event.startAt),
      endAt: new Date(event.endAt),
      color: event.color ?? EVENT_TYPE_COLORS[event.type] ?? 'hsl(var(--accent))',
      assigneeIds: event.participants.map((p) => p.userId),
      teamIds: event.teamId ? [event.teamId] : [],
      subtitle: event.location ?? undefined,
      raw: event,
    });
  }

  return items;
}

/** Colonnes côte à côte pour les éléments qui se chevauchent. */
export function layoutOverlaps(items: PlanningItem[]): Map<string, { column: number; columns: number }> {
  const sorted = [...items].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const layout = new Map<string, { column: number; columns: number }>();
  let cluster: PlanningItem[] = [];
  let clusterEnd = 0;

  const flush = () => {
    if (cluster.length === 0) return;
    const columns: PlanningItem[][] = [];
    for (const item of cluster) {
      let placed = false;
      for (const [index, column] of columns.entries()) {
        const last = column[column.length - 1];
        if (last.endAt.getTime() <= item.startAt.getTime()) {
          column.push(item);
          layout.set(item.id, { column: index, columns: 0 });
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([item]);
        layout.set(item.id, { column: columns.length - 1, columns: 0 });
      }
    }
    for (const item of cluster) {
      const current = layout.get(item.id);
      if (current) layout.set(item.id, { ...current, columns: columns.length });
    }
    cluster = [];
  };

  for (const item of sorted) {
    if (cluster.length > 0 && item.startAt.getTime() >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endAt.getTime());
  }
  flush();
  return layout;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}
