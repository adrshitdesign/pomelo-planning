import { NavLink, Outlet, useLocation } from 'react-router-dom';
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
  const location = useLocation();
  useRealtimeSync();

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || can(item.permission));
  const current = visibleItems.find((item) => location.pathname.startsWith(item.to));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Navigation latérale : bandeau sombre, section active surlignée. */}
      <aside className="flex w-56 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-accent text-[13px] font-bold text-accent-foreground">
            PP
          </span>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold tracking-tight">Pomelo-Paradigm</p>
            <p className="text-[11px] text-sidebar-muted">Planning &amp; tickets</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors',
                  isActive
                    ? 'bg-sidebar-active font-medium text-white'
                    : 'text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />
                  )}
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <div className="flex items-center gap-2 rounded-md px-2 py-2">
            <Avatar name={user?.name ?? '?'} url={user?.avatarUrl} size={28} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{user?.name}</p>
              <p className="truncate text-[11px] capitalize text-sidebar-muted">
                {user?.roles.join(', ') || 'aucun rôle'}
              </p>
            </div>
            <button
              onClick={() => void logout()}
              title="Se déconnecter"
              className="rounded p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
          <h1 className="text-sm font-semibold">{current?.label ?? 'Pomelo-Paradigm'}</h1>
          <button className="relative ml-auto rounded p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground">
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
