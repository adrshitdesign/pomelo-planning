import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { durationToHeight, minutesToOffset, type PlanningItem } from './planning-utils';

interface Props {
  item: PlanningItem;
  /** Ressource (personne) de la colonne d'origine, pour la réassignation. */
  resourceId?: string;
  layout?: { column: number; columns: number };
  readOnly?: boolean;
  onOpen: (item: PlanningItem) => void;
  onContextMenu: (item: PlanningItem, position: { x: number; y: number }) => void;
  onResizeStart: (item: PlanningItem, event: React.PointerEvent) => void;
  isResizing?: boolean;
  resizePreviewHeight?: number;
}

/**
 * Carte du planning. Ticket = bordure gauche pleine colorée ;
 * événement = bordure gauche en pointillés (brief section 7).
 */
export function PlanningItemCard({
  item,
  resourceId,
  layout,
  readOnly,
  onOpen,
  onContextMenu,
  onResizeStart,
  isResizing,
  resizePreviewHeight,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `item:${item.id}:${resourceId ?? 'none'}`,
    data: { item, resourceId },
    disabled: readOnly || isResizing,
  });

  const columns = layout?.columns ?? 1;
  const columnIndex = layout?.column ?? 0;
  const width = `calc(${100 / columns}% - 4px)`;
  const left = `calc(${(columnIndex * 100) / columns}% + 2px)`;

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        top: minutesToOffset(item.startAt),
        height: resizePreviewHeight ?? durationToHeight(item.startAt, item.endAt),
        left,
        width,
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 40 : 10,
        opacity: isDragging ? 0.75 : 1,
        // Couleur de catégorie consommée par les classes .planning-item--*
        ['--item-color' as string]: item.color,
      }}
      className={cn(
        'planning-item group cursor-grab select-none px-1.5 py-1 active:cursor-grabbing',
        item.kind === 'ticket' ? 'planning-item--ticket' : 'planning-item--event',
        isDragging && 'ring-2 ring-ring',
      )}
      onDoubleClick={() => onOpen(item)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(item, { x: event.clientX, y: event.clientY });
      }}
      {...attributes}
      {...listeners}
    >
      <p className="truncate text-[11px] font-medium leading-tight">{item.title}</p>
      <p className="truncate text-[10px] text-muted-foreground">
        {format(item.startAt, 'HH:mm')} – {format(item.endAt, 'HH:mm')}
        {item.subtitle ? ` · ${item.subtitle}` : ''}
      </p>

      {/* Poignée de redimensionnement : change la durée (brief section 8). */}
      {!readOnly && (
        <span
          role="separator"
          aria-label="Redimensionner"
          onPointerDown={(event) => {
            event.stopPropagation();
            onResizeStart(item, event);
          }}
          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: item.color }}
        />
      )}
    </div>
  );
}
