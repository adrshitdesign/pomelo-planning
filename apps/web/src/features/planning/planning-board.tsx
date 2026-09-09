import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { addMinutes, differenceInMinutes, format, isToday, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/misc';
import { PlanningColumn, TimeGutter } from './planning-column';
import { MonthGrid } from './planning-month';
import {
  HOUR_WIDTH,
  PlanningDayTimeline,
  pixelsToSnappedMinutesX,
  type TimelineGroup,
} from './planning-day-timeline';
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
  const [resizingX, setResizingX] = useState<{ id: string; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState(false);
  const duplicateRef = useRef(false);

  /**
   * Suivi permanent des touches de modification. Se fier au seul événement de
   * départ du glisser ne marche pas : on appuie souvent sur la touche APRÈS
   * avoir commencé à déplacer la carte. Alt (⌥ sur Mac), Ctrl ou Cmd.
   */
  useEffect(() => {
    const sync = (event: KeyboardEvent) => {
      const active = event.altKey || event.ctrlKey || event.metaKey;
      duplicateRef.current = active;
      setDuplicateMode(active);
    };
    const reset = () => {
      duplicateRef.current = false;
      setDuplicateMode(false);
    };

    window.addEventListener('keydown', sync);
    window.addEventListener('keyup', sync);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', sync);
      window.removeEventListener('keyup', sync);
      window.removeEventListener('blur', reset);
    };
  }, []);

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
        label: 'Toute l’équipe',
        resource: undefined,
        filter: () => true,
      },
    ];
  }, [groupMode, resources, teams]);

  // --- Drag & drop ---------------------------------------------------------

  const onDragStart = (event: DragStartEvent) => {
    setDragging(true);
    // Touche déjà enfoncée au moment du clic initial.
    const activator = event.activatorEvent as PointerEvent | undefined;
    if (activator?.altKey || activator?.ctrlKey || activator?.metaKey) {
      duplicateRef.current = true;
      setDuplicateMode(true);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragging(false);
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

    const duplicate = duplicateRef.current;
    const unchanged =
      startAt.getTime() === item.startAt.getTime() &&
      (overData?.resourceId ?? previousResourceId) === previousResourceId;
    if (unchanged && !duplicate) return;

    onDrop({
      item,
      startAt,
      endAt,
      resourceId: overData?.resourceId,
      previousResourceId,
      duplicate,
    });
    // On ne remet pas le drapeau à zéro ici : la touche peut rester enfoncée
    // pour enchaîner plusieurs copies. Le relâchement s'en charge.
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

  // --- Vue journée : frise horizontale --------------------------------------

  /** Lignes de la frise : par équipe si le regroupement le demande. */
  const timelineGroups = useMemo<TimelineGroup[]>(() => {
    if (groupMode === 'team') {
      return teams.map((team) => ({
        key: team.id,
        label: team.name,
        resources: resources.filter((r) => r.teams.some((t) => t.id === team.id)),
      }));
    }
    return [{ key: 'all', label: 'Toute l’équipe', resources }];
  }, [groupMode, resources, teams]);

  const handleDragEndHorizontal = (event: DragEndEvent) => {
    setDragging(false);
    const item = event.active.data.current?.item as PlanningItem | undefined;
    if (!item) return;

    const previousResourceId = event.active.data.current?.resourceId as string | undefined;
    const overData = event.over?.data.current as { resourceId?: string } | undefined;

    const deltaMinutes = pixelsToSnappedMinutesX(event.delta.x);
    const startAt = addMinutes(item.startAt, deltaMinutes);
    const endAt = addMinutes(startAt, differenceInMinutes(item.endAt, item.startAt));

    const duplicate = duplicateRef.current;
    const targetResource = overData?.resourceId;
    const unchanged =
      deltaMinutes === 0 && (targetResource ?? previousResourceId) === previousResourceId;
    if (unchanged && !duplicate) return;

    onDrop({
      item,
      startAt,
      endAt,
      resourceId: targetResource,
      previousResourceId,
      duplicate,
    });
  };

  /** Redimensionnement horizontal (bord droit d'une barre). */
  const startResizeX = (item: PlanningItem, event: React.PointerEvent) => {
    if (readOnly) return;
    event.preventDefault();
    const startX = event.clientX;
    const pxPerMinute = HOUR_WIDTH / 60;
    const initialWidth = differenceInMinutes(item.endAt, item.startAt) * pxPerMinute;
    setResizingX({ id: item.id, width: initialWidth });

    const onMove = (moveEvent: PointerEvent) => {
      setResizingX({
        id: item.id,
        width: Math.max(HOUR_WIDTH / 3, initialWidth + (moveEvent.clientX - startX)),
      });
    };
    const onUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setResizingX(null);

      const deltaMinutes = pixelsToSnappedMinutesX(upEvent.clientX - startX);
      if (deltaMinutes === 0) return;
      const duration = differenceInMinutes(item.endAt, item.startAt) + deltaMinutes;
      if (duration < SLOT_MINUTES) return;
      onResize(item, addMinutes(item.startAt, duration));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // --- Rendu ---------------------------------------------------------------

  if (view === 'day') {
    return (
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={handleDragEndHorizontal}
        onDragCancel={() => setDragging(false)}
      >
        <DuplicateBadge visible={dragging && duplicateMode} />
        <PlanningDayTimeline
          day={days[0] ?? anchor}
          groups={timelineGroups}
          items={items}
          readOnly={readOnly}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
          onResizeStart={startResizeX}
          onEmptySlotClick={onEmptySlotClick}
          resizing={resizingX}
        />
      </DndContext>
    );
  }

  if (view === 'month') {
    return (
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragging(false)}
      >
        <DuplicateBadge visible={dragging && duplicateMode} />
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
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(false)}
    >
      <DuplicateBadge visible={dragging && duplicateMode} />
      <div className="h-full overflow-auto">
        {groups.map((group) => {
          const groupItems = items.filter(group.filter);
          return (
            <section key={group.key} className="border-b border-border last:border-b-0">
              <header className="sticky top-0 z-20 flex items-center gap-2 border-y border-border bg-surface-muted px-3 py-1.5">
                {group.resource ? (
                  <Avatar name={group.resource.name} url={group.resource.avatarUrl} size={20} />
                ) : null}
                <h3 className="text-xs font-semibold">{group.label}</h3>
                <span className="text-[11px] text-muted-foreground">
                  {groupItems.length === 0
                    ? 'rien de planifié'
                    : `${groupItems.length} élément${groupItems.length > 1 ? 's' : ''}`}
                </span>
              </header>

              {/* En-têtes de jours, alignés sur les colonnes grâce à un
                  espaceur de la largeur de la colonne des heures. */}
              <div className="flex border-b border-border bg-surface">
                <div className="w-14 shrink-0" />
                <div
                  className="grid flex-1"
                  style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
                >
                  {days.map((day) => (
                    <div
                      key={`head-${day.toISOString()}`}
                      className={cn(
                        'border-r border-border px-2 py-1 text-[11px] font-medium last:border-r-0',
                        isToday(day) ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      <span className="first-letter:uppercase">
                        {format(day, 'EEE d', { locale: fr })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex pt-2">
                <TimeGutter />
                <div
                  className="grid flex-1"
                  style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
                >
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

/** Repère visuel : indique que le prochain dépôt créera une copie. */
function DuplicateBadge({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[90] -translate-x-1/2 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground animate-fade-in">
      Copie — relâchez pour dupliquer
    </div>
  );
}
