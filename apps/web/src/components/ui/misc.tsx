import * as React from 'react';
import { cn, initials } from '@/lib/utils';

export function Badge({
  className,
  color,
  children,
}: {
  className?: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium',
        !color && 'bg-muted text-muted-foreground',
        className,
      )}
      style={color ? { backgroundColor: `${color}1f`, color } : undefined}
    >
      {children}
    </span>
  );
}

export function Avatar({
  name,
  url,
  size = 24,
  className,
}: {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  return url ? (
    <img
      src={url}
      alt={name}
      title={name}
      className={cn('rounded-full object-cover', className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      title={name}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-primary-soft font-medium text-primary',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface p-4', className)}>{children}</div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border p-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary',
        className,
      )}
    />
  );
}

/** Indicateur de synchronisation optimiste (brief section 8). */
export function SyncIndicator({ state }: { state: 'idle' | 'saving' | 'error' }) {
  if (state === 'idle') return null;
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 rounded px-2 py-1 text-[11px]',
        state === 'saving' ? 'bg-muted text-muted-foreground' : 'bg-destructive/10 text-destructive',
      )}
    >
      {state === 'saving' ? (
        <>
          <Spinner className="h-3 w-3" /> Synchronisation…
        </>
      ) : (
        <>⚠ Échec de synchronisation</>
      )}
    </span>
  );
}
