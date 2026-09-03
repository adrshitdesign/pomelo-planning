import { useEffect, useMemo, useRef } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { differenceInMinutes, isToday, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/misc';
import type { PlanningResource } from '@/lib/types';
import { sameDay, type PlanningItem } from './planning-utils';

/**
 * Vue « journée » en frise horizontale : une ligne par personne, les heures en
 * abscisse. C'est la lecture la plus parlante pour un chef d'atelier — qui est
 * occupé, quand, et sur quoi — et la seule qui montre les trous de charge.
 */

export const HOUR_WIDTH = 62;
export const TIMELINE_START_HOUR = 0;
export const TIMELINE_END_HOUR = 24;
export const SNAP_MINUTES = 30;
const LEFT_COLUMN = 224;
const ROW_HEIGHT = 62;

const HOURS = Array.from(
  { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR },
  (_, i) => TIMELINE_START_HOUR + i,
);

const pxPerMinute = HOUR_WIDTH / 60;

export function minutesFromTimelineStart(date: Date): number {
  return (date.getHours() - TIMELINE_START_HOUR) * 60 + date.getMinutes();
}

/** Conversion d'un déplacement horizontal en minutes accrochées au créneau. */
export function pixelsToSnappedMinutesX(deltaX: number): number {
  return Math.round(deltaX / (HOUR_WIDTH * (SNAP_MINUTES / 60))) * SNAP_MINUTES;
}

/** « 7,25 h » — format français, comme sur les feuilles de production. */
function formatHours(minutes: number): string {
  if (minutes <= 0) return '0 h';
  return `${(minutes / 60).toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} h`;
}

export interface TimelineGroup {
  key: string;
  label: string;
  resources: PlanningResource[];
}

interface Props {
  day: Date;
  groups: TimelineGroup[];
  items: PlanningItem[];
  readOnly?: boolean;
  onOpen: (item: PlanningItem) => void;
  onContextMenu: (item: PlanningItem, position: { x: number; y: number }) => void;
  onResizeStart: (item: PlanningItem, event: React.PointerEvent) => void;
  onEmptySlotClick: (date: Date, resourceId?: string) => void;
  resizing?: { id: string; width: number } | null;
}

export function PlanningDayTimeline({
  day,
  groups,
  items,
  readOnly,
  onOpen,
  onContextMenu,
  onResizeStart,
  onEmptySlotClick,
  resizing,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackWidth = HOURS.length * HOUR_WIDTH;

  // Au premier affichage, on cadre sur le début de journée de travail.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 7 * HOUR_WIDTH;
  }, []);

  const byResource = useMemo(() => {
    const map = new Map<string, PlanningItem[]>();
    // Ne garder que ce qui concerne réellement la journée affichée.
    for (const item of items.filter((i) => sameDay(i.startAt, day))) {
      for (const userId of item.assigneeIds) {
        map.set(userId, [...(map.get(userId) ?? []), item]);
      }
    }
    return map;
  }, [items, day]);

  // Une personne peut appartenir à deux équipes : on ne la compte qu'une fois
  // dans les totaux, même si elle apparaît sur deux lignes.
  const allResources = useMemo(() => {
    const seen = new Map<string, PlanningResource>();
    for (const group of groups) {
      for (const resource of group.resources) if (!seen.has(resource.id)) seen.set(resource.id, resource);
    }
    return [...seen.values()];
  }, [groups]);

  /** Nombre de personnes occupées sur chaque heure. */
  const staffedPerHour = HOURS.map((hour) => {
    const from = new Date(day);
    from.setHours(hour, 0, 0, 0);
    const to = new Date(from.getTime() + 3600_000);
    return allResources.filter((resource) =>
      (byResource.get(resource.id) ?? []).some(
        (item) => item.startAt < to && item.endAt > from,
      ),
    ).length;
  });

  const totalMinutes = allResources.reduce(
    (sum, resource) =>
      sum +
      (byResource.get(resource.id) ?? []).reduce(
        (s, item) => s + differenceInMinutes(item.endAt, item.startAt),
        0,
      ),
    0,
  );

  const nowOffset = isToday(day) ? minutesFromTimelineStart(new Date()) * pxPerMinute : null;

  return (
    <div ref={scrollRef} className="h-full overflow-auto">
      <div style={{ minWidth: LEFT_COLUMN + trackWidth }}>
        {/* Règle des heures */}
        <div className="sticky top-0 z-30 flex border-b border-border bg-surface">
          <div
            className="sticky left-0 z-10 flex shrink-0 items-center border-r border-border bg-surface px-3 py-2 text-xs font-medium"
            style={{ width: LEFT_COLUMN }}
          >
            Jour&nbsp;: {formatHours(totalMinutes)}
          </div>
          <div className="relative flex" style={{ width: trackWidth }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className={cn(
                  'shrink-0 border-r border-border py-2 pl-2 text-xs tabular-nums',
                  hour % 3 === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )}
                style={{ width: HOUR_WIDTH }}
              >
                {String(hour).padStart(2, '0')}
              </div>
            ))}
          </div>
        </div>

        {/* Personnes planifiées par heure */}
        <div className="flex border-b border-border bg-surface-muted">
          <div
            className="sticky left-0 z-10 shrink-0 border-r border-border bg-surface-muted px-3 py-1.5 text-[11px] text-muted-foreground"
            style={{ width: LEFT_COLUMN }}
          >
            Personnes planifiées
          </div>
          <div className="flex" style={{ width: trackWidth }}>
            {staffedPerHour.map((count, index) => (
              <div
                key={index}
                className={cn(
                  'shrink-0 border-r border-border py-1.5 text-center text-[11px] tabular-nums',
                  count > 0 ? 'font-medium text-primary' : 'text-muted-foreground/60',
                )}
                style={{ width: HOUR_WIDTH }}
              >
                {count}
              </div>
            ))}
          </div>
        </div>

        {/* Lignes : une par personne, regroupées par équipe le cas échéant */}
        {groups.map((group) => (
          <section key={group.key}>
            {groups.length > 1 && (
              <header
                className="sticky left-0 z-10 flex items-center gap-2 border-b border-border bg-surface-muted px-3 py-1.5"
                style={{ width: LEFT_COLUMN + trackWidth }}
              >
                <span className="sticky left-3 text-xs font-semibold">{group.label}</span>
                <span className="text-[11px] text-muted-foreground">
                  {group.resources.length} personne{group.resources.length > 1 ? 's' : ''}
                </span>
              </header>
            )}

            {group.resources.length === 0 && (
              <p className="px-3 py-3 text-[11px] text-muted-foreground">
                Aucun membre dans cette équipe.
              </p>
            )}

            {group.resources.map((resource) => (
              <TimelineRow
                key={`${group.key}-${resource.id}`}
                day={day}
                resource={resource}
                items={byResource.get(resource.id) ?? []}
                trackWidth={trackWidth}
                nowOffset={nowOffset}
                readOnly={readOnly}
                onOpen={onOpen}
                onContextMenu={onContextMenu}
                onResizeStart={onResizeStart}
                onEmptySlotClick={onEmptySlotClick}
                resizing={resizing}
              />
            ))}
          </section>
        ))}

        {allResources.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Aucune personne à afficher. Vérifiez les filtres.
          </p>
        )}
      </div>
    </div>
  );
}

function TimelineRow({
  day,
  resource,
  items,
  trackWidth,
  nowOffset,
  readOnly,
  onOpen,
  onContextMenu,
  onResizeStart,
  onEmptySlotClick,
  resizing,
}: {
  day: Date;
  resource: PlanningResource;
  items: PlanningItem[];
  trackWidth: number;
  nowOffset: number | null;
  readOnly?: boolean;
  onOpen: (item: PlanningItem) => void;
  onContextMenu: (item: PlanningItem, position: { x: number; y: number }) => void;
  onResizeStart: (item: PlanningItem, event: React.PointerEvent) => void;
  onEmptySlotClick: (date: Date, resourceId?: string) => void;
  resizing?: { id: string; width: number } | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `row:${resource.id}`,
    data: { day, resourceId: resource.id },
  });

  const minutes = items.reduce((sum, item) => sum + differenceInMinutes(item.endAt, item.startAt), 0);

  return (
    <div className="flex border-b border-border">
      <div
        className="sticky left-0 z-10 flex shrink-0 items-center gap-2.5 border-r border-border bg-surface px-3"
        style={{ width: LEFT_COLUMN, height: ROW_HEIGHT }}
      >
        <Avatar name={resource.name} url={resource.avatarUrl} size={30} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium leading-tight">{resource.name}</p>
          <p className="text-[11px] tabular-nums text-muted-foreground">{formatHours(minutes)}</p>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn('relative bg-surface', isOver && 'bg-primary-soft/50')}
        style={{ width: trackWidth, height: ROW_HEIGHT }}
      >
        {/* Créneaux cliquables + quadrillage */}
        {HOURS.map((hour) => (
          <button
            key={hour}
            type="button"
            tabIndex={-1}
            aria-label={`Créer à ${hour}:00 pour ${resource.name}`}
            onClick={() => {
              if (readOnly) return;
              const date = new Date(startOfDay(day));
              date.setHours(hour, 0, 0, 0);
              onEmptySlotClick(date, resource.id);
            }}
            className={cn(
              'absolute top-0 border-r border-[hsl(var(--planning-grid))] transition-colors',
              !readOnly && 'hover:bg-primary-soft/40',
              hour < 7 || hour > 19 ? 'bg-[hsl(var(--planning-offhours))]' : '',
            )}
            style={{ left: (hour - TIMELINE_START_HOUR) * HOUR_WIDTH, width: HOUR_WIDTH, height: ROW_HEIGHT }}
          />
        ))}

        {nowOffset !== null && (
          <div
            className="pointer-events-none absolute top-0 z-20 w-px bg-accent"
            style={{ left: nowOffset, height: ROW_HEIGHT }}
          >
            <span className="absolute -left-[3px] -top-[3px] h-1.5 w-1.5 rounded-full bg-accent" />
          </div>
        )}

        {items.map((item) => (
          <TimelineBar
            key={`${item.kind}-${item.id}`}
            item={item}
            resourceId={resource.id}
            readOnly={readOnly}
            onOpen={onOpen}
            onContextMenu={onContextMenu}
            onResizeStart={onResizeStart}
            width={resizing?.id === item.id ? resizing.width : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineBar({
  item,
  resourceId,
  readOnly,
  onOpen,
  onContextMenu,
  onResizeStart,
  width,
}: {
  item: PlanningItem;
  resourceId: string;
  readOnly?: boolean;
  onOpen: (item: PlanningItem) => void;
  onContextMenu: (item: PlanningItem, position: { x: number; y: number }) => void;
  onResizeStart: (item: PlanningItem, event: React.PointerEvent) => void;
  width?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `item:${item.id}:${resourceId}`,
    data: { item, resourceId },
    disabled: readOnly,
  });

  const left = minutesFromTimelineStart(item.startAt) * pxPerMinute;
  const naturalWidth = Math.max(
    differenceInMinutes(item.endAt, item.startAt) * pxPerMinute,
    HOUR_WIDTH / 3,
  );

  const subtitle = item.subtitle?.split(' · ') ?? [];

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onDoubleClick={() => onOpen(item)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(item, { x: event.clientX, y: event.clientY });
      }}
      style={{
        position: 'absolute',
        top: 5,
        left,
        width: width ?? naturalWidth,
        height: ROW_HEIGHT - 10,
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 40 : 15,
        opacity: isDragging ? 0.75 : 1,
        ['--item-color' as string]: item.color,
        backgroundColor: 'color-mix(in srgb, var(--item-color) 12%, hsl(var(--surface)))',
      }}
      className={cn(
        'planning-item group cursor-grab overflow-hidden px-2 py-1 active:cursor-grabbing',
        item.kind === 'ticket' ? 'planning-item--ticket' : 'planning-item--event',
        isDragging && 'ring-2 ring-ring',
      )}
      title={`${item.title}${item.subtitle ? ` — ${item.subtitle}` : ''}`}
    >
      <p className="truncate text-[11px] font-semibold leading-tight">{item.title}</p>
      {subtitle[0] && (
        <p className="truncate text-[10px] leading-tight text-muted-foreground">{subtitle[0]}</p>
      )}
      {subtitle[1] && (
        <p className="truncate text-[10px] leading-tight text-muted-foreground">{subtitle[1]}</p>
      )}

      {/* Poignée de durée sur le bord droit */}
      {!readOnly && (
        <span
          role="separator"
          aria-label="Changer la durée"
          onPointerDown={(event) => {
            event.stopPropagation();
            onResizeStart(item, event);
          }}
          className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: item.color }}
        />
      )}
    </div>
  );
}
