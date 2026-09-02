import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { format, isSameMonth, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { sameDay, type PlanningItem } from './planning-utils';

function MonthChip({
  item,
  onOpen,
  onContextMenu,
  readOnly,
}: {
  item: PlanningItem;
  readOnly?: boolean;
  onOpen: (item: PlanningItem) => void;
  onContextMenu: (item: PlanningItem, position: { x: number; y: number }) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `item:${item.id}:none`,
    data: { item },
    disabled: readOnly,
  });

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
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.7 : 1,
        ['--item-color' as string]: item.color,
      }}
      className={cn(
        'planning-item cursor-grab truncate px-1.5 py-0.5 text-[11px] active:cursor-grabbing',
        item.kind === 'ticket' ? 'planning-item--ticket' : 'planning-item--event',
      )}
      title={item.title}
    >
      <span className="tabular-nums text-muted-foreground">{format(item.startAt, 'HH:mm')}</span>{' '}
      {item.title}
    </div>
  );
}

function MonthCell({
  day,
  anchor,
  items,
  readOnly,
  onOpen,
  onContextMenu,
  onEmptySlotClick,
}: {
  day: Date;
  anchor: Date;
  items: PlanningItem[];
  readOnly?: boolean;
  onOpen: (item: PlanningItem) => void;
  onContextMenu: (item: PlanningItem, position: { x: number; y: number }) => void;
  onEmptySlotClick: (date: Date) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col:${day.toISOString()}:none`,
    data: { day },
  });
  const dayItems = items.filter((item) => sameDay(item.startAt, day));

  return (
    <div
      ref={setNodeRef}
      onDoubleClick={() => !readOnly && onEmptySlotClick(new Date(day.setHours(9, 0, 0, 0)))}
      className={cn(
        'min-h-24 space-y-0.5 border-b border-r border-border p-1',
        !isSameMonth(day, anchor) && 'bg-surface-muted/60',
        isToday(day) && 'bg-[hsl(var(--planning-today))]',
        isOver && 'bg-primary-soft/60',
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span
          className={cn(
            'text-[11px] tabular-nums',
            isToday(day) ? 'font-semibold text-primary' : 'text-muted-foreground',
          )}
        >
          {format(day, 'd')}
        </span>
        {dayItems.length > 3 && (
          <span className="text-[10px] text-muted-foreground">{dayItems.length}</span>
        )}
      </div>
      {dayItems.slice(0, 4).map((item) => (
        <MonthChip
          key={`${item.kind}-${item.id}`}
          item={item}
          readOnly={readOnly}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
        />
      ))}
      {dayItems.length > 4 && (
        <p className="px-1 text-[10px] text-muted-foreground">+{dayItems.length - 4} autres</p>
      )}
    </div>
  );
}

export function MonthGrid({
  days,
  anchor,
  items,
  readOnly,
  onOpen,
  onContextMenu,
  onEmptySlotClick,
}: {
  days: Date[];
  anchor: Date;
  items: PlanningItem[];
  readOnly?: boolean;
  onOpen: (item: PlanningItem) => void;
  onContextMenu: (item: PlanningItem, position: { x: number; y: number }) => void;
  onEmptySlotClick: (date: Date) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-border bg-surface">
        {days.slice(0, 7).map((day) => (
          <div
            key={day.toISOString()}
            className="border-r border-border px-2 py-1.5 text-[11px] font-medium capitalize text-muted-foreground last:border-r-0"
          >
            {format(day, 'EEEE', { locale: fr })}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7">
        {days.map((day) => (
          <MonthCell
            key={day.toISOString()}
            day={day}
            anchor={anchor}
            items={items}
            readOnly={readOnly}
            onOpen={onOpen}
            onContextMenu={onContextMenu}
            onEmptySlotClick={onEmptySlotClick}
          />
        ))}
      </div>
    </div>
  );
}
