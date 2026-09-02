import { NavLink, Outlet } from 'react-router-dom';
import {
  Calendar,
  KanbanSquare,
  Building2,
  Users,
  LayoutDashboard,
  Settings,
  LogOut,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/misc';
import { useAuth } from '@/store/auth';
import { P, type PermissionKey } from '@/lib/permissions';
import { useNotifications } from '@/hooks/queries';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Calendar;
  permission?: PermissionKey;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/planning', label: 'Planning', icon: Calendar, permission: P.PLANNING_VIEW },
  { to: '/tickets', label: 'Tickets', icon: KanbanSquare, permission: P.TICKET_VIEW },
  { to: '/clients', label: 'Clients & objets', icon: Building2, permission: P.CLIENT_VIEW },
  { to: '/equipes', label: 'Équipes', icon: Users, permission: P.TEAM_VIEW },
  { to: '/tableau-de-bord', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/administration', label: 'Administration', icon: Settings, permission: P.USER_MANAGE },
];

export function AppShell() {
  const { user, logout, can } = useAuth();
  const notifications = useNotifications();
  useRealtimeSync();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Navigation latérale : icônes + libellés, section active surlignée. */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
            PP
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Pomelo-Paradigm</p>
            <p className="text-[11px] text-muted-foreground">Planning &amp; tickets</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-2">
          {NAV_ITEMS.filter((item) => !item.permission || can(item.permission)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary-soft font-medium text-primary'
                    : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-2">
          <div className="flex items-center gap-2 rounded-md px-2 py-2">
            <Avatar name={user?.name ?? '?'} url={user?.avatarUrl} size={28} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{user?.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {user?.roles.join(', ') || 'aucun rôle'}
              </p>
            </div>
            <button
              onClick={() => void logout()}
              title="Se déconnecter"
              className="rounded p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-end gap-2 border-b border-border bg-surface px-4">
          <button className="relative rounded p-1.5 text-muted-foreground hover:bg-surface-muted">
            <Bell className="h-4 w-4" />
            {(notifications.data?.unread ?? 0) > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                {notifications.data?.unread}
              </span>
            )}
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
