import { addDays, addMonths, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { GroupMode, PlanningView } from './planning-utils';
import type { Client, Label, ProjectObject, Status, Team, User } from '@/lib/types';
import { PRIORITY_LABELS } from '@/lib/utils';

const VIEWS: { key: PlanningView; label: string }[] = [
  { key: 'day', label: 'Jour' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
];

const GROUPS: { key: GroupMode; label: string }[] = [
  { key: 'person', label: 'Par personne' },
  { key: 'team', label: 'Par équipe' },
  { key: 'company', label: 'Entreprise' },
];

export interface PlanningFilters {
  teamId?: string;
  userId?: string;
  clientId?: string;
  projectObjectId?: string;
  statusId?: string;
  priority?: string;
  labelId?: string;
  /** Ne garder que les tâches sans personne assignée. */
  unassignedOnly?: boolean;
}

/** Nombre de filtres actifs, pour l'afficher et permettre de tout effacer. */
export function countActiveFilters(filters: PlanningFilters): number {
  return Object.values(filters).filter(Boolean).length;
}

export function PlanningToolbar({
  view,
  groupMode,
  anchor,
  filters,
  teams,
  users,
  clients,
  projectObjects,
  statuses,
  labels,
  canCreate,
  onViewChange,
  onGroupChange,
  onAnchorChange,
  onFiltersChange,
  onCreate,
}: {
  view: PlanningView;
  groupMode: GroupMode;
  anchor: Date;
  filters: PlanningFilters;
  teams: Team[];
  users: User[];
  clients: Client[];
  projectObjects: ProjectObject[];
  statuses: Status[];
  labels: Label[];
  canCreate: boolean;
  onViewChange: (view: PlanningView) => void;
  onGroupChange: (mode: GroupMode) => void;
  onAnchorChange: (date: Date) => void;
  onFiltersChange: (filters: PlanningFilters) => void;
  onCreate: () => void;
}) {
  const step = (direction: 1 | -1) => {
    if (view === 'month') return onAnchorChange(addMonths(anchor, direction));
    onAnchorChange(addDays(anchor, direction * (view === 'week' ? 7 : 1)));
  };

  const title =
    view === 'month'
      ? format(anchor, 'MMMM yyyy', { locale: fr })
      : view === 'day'
        ? format(anchor, 'EEEE d MMMM yyyy', { locale: fr })
        : format(anchor, "'Semaine du' d MMMM yyyy", { locale: fr });

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label="Précédent">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onAnchorChange(new Date())}>
          Aujourd'hui
        </Button>
        <Button variant="ghost" size="icon" onClick={() => step(1)} aria-label="Suivant">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <p className="min-w-52 text-sm font-medium first-letter:uppercase">{title}</p>

      <div className="flex overflow-hidden rounded-md border border-border">
        {VIEWS.map((item) => (
          <button
            key={item.key}
            onClick={() => onViewChange(item.key)}
            className={cn(
              'px-3 py-1.5 text-xs transition-colors',
              view === item.key
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-surface-muted text-muted-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Select
        className="h-8 w-36"
        value={groupMode}
        onChange={(e) => onGroupChange(e.target.value as GroupMode)}
        aria-label="Regroupement"
      >
        {GROUPS.map((group) => (
          <option key={group.key} value={group.key}>
            {group.label}
          </option>
        ))}
      </Select>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Select
          className="h-8 w-44"
          value={filters.teamId ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, teamId: e.target.value || undefined })}
          aria-label="Filtrer par équipe"
        >
          <option value="">Toutes les équipes</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>

        <Select
          className="h-8 w-44"
          value={filters.userId ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, userId: e.target.value || undefined })}
          aria-label="Filtrer par personne"
        >
          <option value="">Tout le monde</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </Select>

        <Select
          className="h-8 w-44"
          value={filters.clientId ?? ''}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              clientId: e.target.value || undefined,
              projectObjectId: undefined,
            })
          }
          aria-label="Filtrer par client"
        >
          <option value="">Tous les clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>

        <Select
          className="h-8 w-44"
          value={filters.projectObjectId ?? ''}
          onChange={(e) =>
            onFiltersChange({ ...filters, projectObjectId: e.target.value || undefined })
          }
          aria-label="Filtrer par type de mission"
        >
          <option value="">Toutes les missions</option>
          {projectObjects
            .filter((o) => !o.clientId || !filters.clientId || o.clientId === filters.clientId)
            .map((object) => (
              <option key={object.id} value={object.id}>
                {object.name}
              </option>
            ))}
        </Select>

        <Select
          className="h-8 w-40"
          value={filters.statusId ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, statusId: e.target.value || undefined })}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          {statuses.map((status) => (
            <option key={status.id} value={status.id}>
              {status.name}
            </option>
          ))}
        </Select>

        <Select
          className="h-8 w-32"
          value={filters.priority ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, priority: e.target.value || undefined })}
          aria-label="Filtrer par priorité"
        >
          <option value="">Priorité</option>
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <Select
          className="h-8 w-40"
          value={filters.labelId ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, labelId: e.target.value || undefined })}
          aria-label="Filtrer par étiquette"
        >
          <option value="">Toutes les étiquettes</option>
          {labels.map((label) => (
            <option key={label.id} value={label.id}>
              {label.name}
            </option>
          ))}
        </Select>

        <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={Boolean(filters.unassignedOnly)}
            onChange={(e) =>
              onFiltersChange({ ...filters, unassignedOnly: e.target.checked || undefined })
            }
          />
          Sans personne
        </label>

        {countActiveFilters(filters) > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFiltersChange({})}
            title="Effacer les filtres"
          >
            <X className="h-3.5 w-3.5" /> {countActiveFilters(filters)}
          </Button>
        )}

        {canCreate && (
          <Button size="sm" onClick={onCreate}>
            <Plus className="h-4 w-4" /> Nouvelle tâche
          </Button>
        )}
      </div>
    </div>
  );
}
