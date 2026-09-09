import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { durationToHeight, minutesToOffset, type PlanningItem } from './planning-utils';

/** Repère discret pour les deux priorités qui comptent. */
const PRIORITY_MARK: Partial<Record<NonNullable<PlanningItem['priority']>, string>> = {
  HIGH: '!',
  URGENT: '!!',
};

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
      <div className="flex items-start gap-1">
        {/* Pastille de statut : la couleur du statut, en un coup d'œil. */}
        {item.statusColor && (
          <span
            className="mt-[3px] h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: item.statusColor }}
            title={item.statusName}
          />
        )}
        <p className="min-w-0 flex-1 truncate text-[11px] font-medium leading-tight">{item.title}</p>
        {item.priority && PRIORITY_MARK[item.priority] && (
          <span
            className="shrink-0 text-[11px] font-bold leading-tight text-destructive"
            title={item.priority === 'URGENT' ? 'Urgent' : 'Priorité haute'}
          >
            {PRIORITY_MARK[item.priority]}
          </span>
        )}
      </div>

      {/* Client · type de mission */}
      {item.subtitle && (
        <p className="truncate text-[10px] font-medium text-muted-foreground">{item.subtitle}</p>
      )}

      <p className="truncate text-[10px] text-muted-foreground">
        {format(item.startAt, 'HH:mm')} – {format(item.endAt, 'HH:mm')}
        {item.adjustedByActual && ' · réel'}
      </p>

      {/* Étiquettes : de simples traits colorés, pour ne pas saturer la carte. */}
      {item.labels.length > 0 && (
        <div className="mt-0.5 flex flex-wrap gap-0.5">
          {item.labels.slice(0, 4).map((label) => (
            <span
              key={label.id}
              title={label.name}
              className="h-1 w-4 rounded-full"
              style={{ backgroundColor: label.color }}
            />
          ))}
        </div>
      )}

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
