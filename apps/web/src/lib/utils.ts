import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Couleur stable dérivée d'un identifiant, piochée dans les tokens de catégorie. */
export function categoryColor(seed: string | null | undefined): string {
  if (!seed) return 'hsl(var(--category-1))';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(var(--category-${(hash % 6) + 1}))`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Basse',
  MEDIUM: 'Normale',
  HIGH: 'Haute',
  URGENT: 'Urgente',
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  MEETING: 'Réunion',
  LEAVE: 'Congé',
  APPOINTMENT: 'Rendez-vous',
  TRAINING: 'Formation',
  OTHER: 'Autre',
};
