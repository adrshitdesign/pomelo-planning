import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';

/**
 * Synchronisation temps réel : la base pousse les changements, on rafraîchit
 * les écrans concernés. Les déplacements faits localement restent optimistes.
 */
export function useRealtimeSync() {
  const qc = useQueryClient();
  const status = useAuth((s) => s.status);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const refreshPlanning = () => {
      void qc.invalidateQueries({ queryKey: ['planning'] });
      void qc.invalidateQueries({ queryKey: ['tickets'] });
    };

    const channel = supabase
      .channel('planning-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, refreshPlanning)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_assignees' }, refreshPlanning)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, refreshPlanning)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () =>
        qc.invalidateQueries({ queryKey: ['ticket'] }),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () =>
        qc.invalidateQueries({ queryKey: ['notifications'] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, status]);
}
