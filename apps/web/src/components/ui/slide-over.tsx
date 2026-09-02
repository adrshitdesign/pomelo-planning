import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Panneau latéral : le détail d'un ticket s'ouvre ici, jamais en pleine page
 * (brief section 6).
 */
export function SlideOver({
  open,
  onOpenChange,
  title,
  subtitle,
  actions,
  children,
  width = 'max-w-xl',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/20 animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-border bg-surface',
            'animate-slide-in-right focus:outline-none',
            width,
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-base font-semibold">{title}</Dialog.Title>
              {subtitle && (
                <Dialog.Description className="mt-0.5 truncate text-xs text-muted-foreground">
                  {subtitle}
                </Dialog.Description>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {actions}
              <Dialog.Close className="rounded p-1.5 hover:bg-surface-muted" aria-label="Fermer">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Modale centrée, pour les formulaires courts. */
export function Modal({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/20 animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 animate-fade-in focus:outline-none">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="rounded p-1 hover:bg-surface-muted" aria-label="Fermer">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
