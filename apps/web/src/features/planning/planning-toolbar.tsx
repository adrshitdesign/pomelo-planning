import { addDays, addMonths, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { GroupMode, PlanningView } from './planning-utils';
import type { Client, Team, User } from '@/lib/types';

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
}

export function PlanningToolbar({
  view,
  groupMode,
  anchor,
  filters,
  teams,
  users,
  clients,
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
          onChange={(e) => onFiltersChange({ ...filters, clientId: e.target.value || undefined })}
          aria-label="Filtrer par client"
        >
          <option value="">Tous les clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>

        {canCreate && (
          <Button size="sm" onClick={onCreate}>
            <Plus className="h-4 w-4" /> Nouvelle tâche
          </Button>
        )}
      </div>
    </div>
  );
}
