import { useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { addMinutes, differenceInMinutes, format, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/misc';
import { PlanningColumn, TimeGutter } from './planning-column';
import { MonthGrid } from './planning-month';
import {
  DAY_START_HOUR,
  SLOT_HEIGHT,
  SLOT_MINUTES,
  durationToHeight,
  pixelsToSnappedMinutes,
  type GroupMode,
  type PlanningItem,
  type PlanningView,
} from './planning-utils';
import type { PlanningResource, Team } from '@/lib/types';

export interface DropResult {
  item: PlanningItem;
  startAt: Date;
  endAt: Date;
  /** Personne de la colonne d'arrivée (réassignation implicite). */
  resourceId?: string;
  previousResourceId?: string;
  /** Ctrl/Cmd maintenu au moment du drop → duplication. */
  duplicate: boolean;
}

interface Props {
  view: PlanningView;
  groupMode: GroupMode;
  anchor: Date;
  days: Date[];
  items: PlanningItem[];
  resources: PlanningResource[];
  teams: Team[];
  readOnly?: boolean;
  onDrop: (result: DropResult) => void;
  onResize: (item: PlanningItem, endAt: Date) => void;
  onOpen: (item: PlanningItem) => void;
  onContextMenu: (item: PlanningItem, position: { x: number; y: number }) => void;
  onEmptySlotClick: (date: Date, resourceId?: string) => void;
}

export function PlanningBoard({
  view,
  groupMode,
  anchor,
  days,
  items,
  resources,
  teams,
  readOnly,
  onDrop,
  onResize,
  onOpen,
  onContextMenu,
  onEmptySlotClick,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [resizing, setResizing] = useState<{ id: string; height: number } | null>(null);
  const duplicateRef = useRef(false);

  const groups = useMemo(() => {
    if (groupMode === 'person') {
      return resources.map((resource) => ({
        key: resource.id,
        label: resource.name,
        resource,
        filter: (item: PlanningItem) => item.assigneeIds.includes(resource.id),
      }));
    }
    if (groupMode === 'team') {
      return teams.map((team) => ({
        key: team.id,
        label: team.name,
        resource: undefined,
        filter: (item: PlanningItem) => item.teamIds.includes(team.id),
      }));
    }
    return [
      {
        key: 'company',
        label: 'Pomelo-Paradigm',
        resource: undefined,
        filter: () => true,
      },
    ];
  }, [groupMode, resources, teams]);

  // --- Drag & drop ---------------------------------------------------------

  const onDragStart = (event: DragStartEvent) => {
    const activator = event.activatorEvent as PointerEvent | undefined;
    duplicateRef.current = Boolean(activator?.ctrlKey || activator?.metaKey);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const item = event.active.data.current?.item as PlanningItem | undefined;
    if (!item) return;

    const previousResourceId = event.active.data.current?.resourceId as string | undefined;
    const overData = event.over?.data.current as
      | { day?: Date; resourceId?: string }
      | undefined;

    const targetDay = overData?.day ?? startOfDay(item.startAt);
    const minutesDelta = view === 'month' ? 0 : pixelsToSnappedMinutes(event.delta.y);

    // Heure d'origine reportée sur le jour d'arrivée, puis décalage vertical.
    const minutesFromDayStart =
      (item.startAt.getHours() - DAY_START_HOUR) * 60 + item.startAt.getMinutes();
    let startAt = addMinutes(
      addMinutes(startOfDay(targetDay), DAY_START_HOUR * 60),
      minutesFromDayStart + minutesDelta,
    );

    // Garde-fou : on reste dans l'amplitude affichée.
    if (startAt.getHours() < DAY_START_HOUR) {
      startAt = addMinutes(startOfDay(targetDay), DAY_START_HOUR * 60);
    }
    const duration = Math.max(differenceInMinutes(item.endAt, item.startAt), SLOT_MINUTES);
    const endAt = addMinutes(startAt, duration);

    const unchanged =
      startAt.getTime() === item.startAt.getTime() &&
      (overData?.resourceId ?? previousResourceId) === previousResourceId;
    if (unchanged && !duplicateRef.current) return;

    onDrop({
      item,
      startAt,
      endAt,
      resourceId: overData?.resourceId,
      previousResourceId,
      duplicate: duplicateRef.current,
    });
    duplicateRef.current = false;
  };

  // --- Redimensionnement ---------------------------------------------------

  const startResize = (item: PlanningItem, event: React.PointerEvent) => {
    if (readOnly) return;
    event.preventDefault();
    const startY = event.clientY;
    const initialHeight = durationToHeight(item.startAt, item.endAt);
    setResizing({ id: item.id, height: initialHeight });

    const onMove = (moveEvent: PointerEvent) => {
      const height = Math.max(SLOT_HEIGHT / 2, initialHeight + (moveEvent.clientY - startY));
      setResizing({ id: item.id, height });
    };

    const onUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setResizing(null);

      const deltaMinutes = pixelsToSnappedMinutes(upEvent.clientY - startY);
      if (deltaMinutes === 0) return;
      const duration = differenceInMinutes(item.endAt, item.startAt) + deltaMinutes;
      if (duration < SLOT_MINUTES) return;
      onResize(item, addMinutes(item.startAt, duration));
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // --- Rendu ---------------------------------------------------------------

  if (view === 'month') {
    return (
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={handleDragEnd}>
        <MonthGrid
          days={days}
          anchor={anchor}
          items={items}
          readOnly={readOnly}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
          onEmptySlotClick={onEmptySlotClick}
        />
      </DndContext>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full overflow-auto">
        {groups.map((group) => {
          const groupItems = items.filter(group.filter);
          return (
            <section key={group.key} className="border-b border-border last:border-b-0">
              <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-surface px-3 py-1.5">
                {group.resource ? (
                  <Avatar name={group.resource.name} url={group.resource.avatarUrl} size={20} />
                ) : null}
                <h3 className="text-xs font-semibold">{group.label}</h3>
                <span className="text-[11px] text-muted-foreground">
                  {groupItems.length} élément{groupItems.length > 1 ? 's' : ''}
                </span>
              </header>

              <div className="flex">
                <TimeGutter />
                <div
                  className="grid flex-1"
                  style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
                >
                  {/* En-têtes de jours */}
                  {days.map((day) => (
                    <div
                      key={`head-${day.toISOString()}`}
                      className={cn(
                        'border-b border-r border-border px-2 py-1 text-[11px] capitalize last:border-r-0',
                        'sticky top-8 z-10 bg-surface',
                      )}
                    >
                      {format(day, view === 'day' ? "EEEE d MMMM" : 'EEE d', { locale: fr })}
                    </div>
                  ))}
                  {days.map((day) => (
                    <PlanningColumn
                      key={`${group.key}-${day.toISOString()}`}
                      day={day}
                      resourceId={group.resource?.id}
                      items={groupItems}
                      readOnly={readOnly}
                      onOpen={onOpen}
                      onContextMenu={onContextMenu}
                      onResizeStart={startResize}
                      onEmptySlotClick={onEmptySlotClick}
                      resizing={resizing}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </DndContext>
  );
}
