import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { ToastProvider } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/misc';
import { LoginPage } from '@/pages/login';
import { PlanningPage } from '@/pages/planning';
import { TicketsPage } from '@/pages/tickets';
import { ClientsPage } from '@/pages/clients';
import { TeamsPage } from '@/pages/teams';
import { DashboardPage } from '@/pages/dashboard';
import { AdminPage } from '@/pages/admin';
import { useAuth } from '@/store/auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

function Protected() {
  const status = useAuth((s) => s.status);
  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  return status === 'authenticated' ? <AppShell /> : <Navigate to="/connexion" replace />;
}

export function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  const status = useAuth((s) => s.status);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {/* Le chemin de base change entre le développement (/) et GitHub
            Pages (/nom-du-depot/) : Vite le fournit à la compilation. */}
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route
              path="/connexion"
              element={status === 'authenticated' ? <Navigate to="/planning" replace /> : <LoginPage />}
            />
            <Route element={<Protected />}>
              <Route path="/" element={<Navigate to="/planning" replace />} />
              <Route path="/planning" element={<PlanningPage />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/equipes" element={<TeamsPage />} />
              <Route path="/tableau-de-bord" element={<DashboardPage />} />
              <Route path="/administration" element={<AdminPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/planning" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
