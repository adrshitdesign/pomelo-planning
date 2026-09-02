import { useEffect, useRef } from 'react';
import { Copy, History, UserPlus, CheckCircle2, Trash2, PanelRight } from 'lucide-react';
import type { Status } from '@/lib/types';
import type { PlanningItem } from './planning-utils';

export interface ContextMenuState {
  item: PlanningItem;
  x: number;
  y: number;
}

/** Menu contextuel : dupliquer, changer statut, assigner, historique (section 8). */
export function ItemContextMenu({
  state,
  statuses,
  canEdit,
  onClose,
  onOpen,
  onDuplicate,
  onStatusChange,
  onAssign,
  onHistory,
  onArchive,
}: {
  state: ContextMenuState;
  statuses: Status[];
  canEdit: boolean;
  onClose: () => void;
  onOpen: (item: PlanningItem) => void;
  onDuplicate: (item: PlanningItem) => void;
  onStatusChange: (item: PlanningItem, statusId: string) => void;
  onAssign: (item: PlanningItem) => void;
  onHistory: (item: PlanningItem) => void;
  onArchive: (item: PlanningItem) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const isTicket = state.item.kind === 'ticket';

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[80] w-56 overflow-hidden rounded-md border border-border bg-surface py-1 text-sm animate-fade-in"
      style={{
        top: Math.min(state.y, window.innerHeight - 320),
        left: Math.min(state.x, window.innerWidth - 240),
      }}
    >
      <MenuItem icon={PanelRight} label="Ouvrir le détail" onClick={() => onOpen(state.item)} />

      {isTicket && canEdit && (
        <>
          <MenuItem icon={Copy} label="Dupliquer" onClick={() => onDuplicate(state.item)} />
          <MenuItem icon={UserPlus} label="Assigner…" onClick={() => onAssign(state.item)} />

          <div className="my-1 border-t border-border" />
          <p className="px-3 py-1 text-[11px] font-medium text-muted-foreground">Changer le statut</p>
          {statuses.map((status) => (
            <button
              key={status.id}
              role="menuitem"
              onClick={() => onStatusChange(state.item, status.id)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-muted"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: status.color }}
              />
              <span className="truncate text-xs">{status.name}</span>
              {state.item.statusName === status.name && (
                <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-primary" />
              )}
            </button>
          ))}
        </>
      )}

      <div className="my-1 border-t border-border" />
      <MenuItem icon={History} label="Historique" onClick={() => onHistory(state.item)} />
      {canEdit && (
        <MenuItem
          icon={Trash2}
          label="Archiver"
          destructive
          onClick={() => onArchive(state.item)}
        />
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface-muted ${
        destructive ? 'text-destructive' : ''
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
