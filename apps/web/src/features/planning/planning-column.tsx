import { useDroppable } from '@dnd-kit/core';
import { format, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { PlanningItemCard } from './planning-item-card';
import {
  DAY_START_HOUR,
  SLOTS_PER_DAY,
  SLOT_HEIGHT,
  SLOT_MINUTES,
  layoutOverlaps,
  sameDay,
  slotToDate,
  type PlanningItem,
} from './planning-utils';

interface Props {
  day: Date;
  /** Ressource (personne) de la colonne, si la vue est groupée par personne. */
  resourceId?: string;
  items: PlanningItem[];
  readOnly?: boolean;
  highlightToday?: boolean;
  onOpen: (item: PlanningItem) => void;
  onContextMenu: (item: PlanningItem, position: { x: number; y: number }) => void;
  onResizeStart: (item: PlanningItem, event: React.PointerEvent) => void;
  onEmptySlotClick: (date: Date, resourceId?: string) => void;
  resizing?: { id: string; height: number } | null;
}

/** Une colonne = un jour (× une personne en vue « par personne »). */
export function PlanningColumn({
  day,
  resourceId,
  items,
  readOnly,
  highlightToday = true,
  onOpen,
  onContextMenu,
  onResizeStart,
  onEmptySlotClick,
  resizing,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col:${day.toISOString()}:${resourceId ?? 'none'}`,
    data: { day, resourceId },
  });

  const dayItems = items.filter((item) => sameDay(item.startAt, day));
  const layout = layoutOverlaps(dayItems);
  const today = highlightToday && isToday(day);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative border-r border-border last:border-r-0',
        // Le jour actif est mis en évidence par une colonne surlignée (section 7).
        today && 'bg-[hsl(var(--planning-today))]',
        isOver && 'bg-primary-soft/60',
      )}
      style={{ height: SLOTS_PER_DAY * SLOT_HEIGHT }}
    >
      {/* Grille horaire + zones cliquables pour la création rapide. */}
      {Array.from({ length: SLOTS_PER_DAY }).map((_, index) => {
        const isHourStart = ((index * SLOT_MINUTES) % 60) === 0;
        return (
          <button
            key={index}
            type="button"
            tabIndex={-1}
            aria-label={`Créer à ${format(slotToDate(day, index), 'HH:mm')}`}
            onClick={() => !readOnly && onEmptySlotClick(slotToDate(day, index), resourceId)}
            className={cn(
              'absolute inset-x-0 border-t border-[hsl(var(--planning-grid))] transition-colors',
              isHourStart ? 'border-solid' : 'border-dotted',
              !readOnly && 'hover:bg-primary-soft/50',
            )}
            style={{ top: index * SLOT_HEIGHT, height: SLOT_HEIGHT }}
          />
        );
      })}

      {dayItems.map((item) => (
        <PlanningItemCard
          key={`${item.kind}-${item.id}`}
          item={item}
          resourceId={resourceId}
          layout={layout.get(item.id)}
          readOnly={readOnly}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
          onResizeStart={onResizeStart}
          isResizing={resizing?.id === item.id}
          resizePreviewHeight={resizing?.id === item.id ? resizing.height : undefined}
        />
      ))}
    </div>
  );
}

/** Colonne des heures, à gauche de la grille. */
export function TimeGutter() {
  return (
    <div className="relative w-14 shrink-0" style={{ height: SLOTS_PER_DAY * SLOT_HEIGHT }}>
      {Array.from({ length: SLOTS_PER_DAY }).map((_, index) => {
        const minutes = index * SLOT_MINUTES;
        if (minutes % 60 !== 0) return null;
        return (
          <div
            key={index}
            className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
            style={{ top: index * SLOT_HEIGHT }}
          >
            {String(DAY_START_HOUR + minutes / 60).padStart(2, '0')}:00
          </div>
        );
      })}
    </div>
  );
}
