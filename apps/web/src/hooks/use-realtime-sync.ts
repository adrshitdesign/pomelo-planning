import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectRealtime, disconnectRealtime } from '@/lib/realtime';
import { useAuth } from '@/store/auth';

const PLANNING_EVENTS = [
  'ticket.created',
  'ticket.updated',
  'ticket.moved',
  'ticket.archived',
  'event.created',
  'event.updated',
  'event.archived',
] as const;

/**
 * Sync temps réel : à chaque événement serveur, on invalide les caches
 * concernés. Les déplacements faits localement restent optimistes.
 */
export function useRealtimeSync() {
  const qc = useQueryClient();
  const status = useAuth((s) => s.status);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const socket = connectRealtime();
    const refreshPlanning = () => {
      void qc.invalidateQueries({ queryKey: ['planning'] });
      void qc.invalidateQueries({ queryKey: ['tickets'] });
      void qc.invalidateQueries({ queryKey: ['events'] });
    };

    PLANNING_EVENTS.forEach((event) => socket.on(event, refreshPlanning));
    socket.on('comment.created', () => void qc.invalidateQueries({ queryKey: ['ticket'] }));
    socket.on('notification.created', () =>
      qc.invalidateQueries({ queryKey: ['notifications'] }),
    );

    return () => {
      PLANNING_EVENTS.forEach((event) => socket.off(event, refreshPlanning));
      socket.off('comment.created');
      socket.off('notification.created');
      disconnectRealtime();
    };
  }, [qc, status]);
}
