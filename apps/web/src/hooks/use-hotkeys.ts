import { useEffect } from 'react';

export interface Hotkey {
  /** Touche telle que renvoyée par KeyboardEvent.key (insensible à la casse). */
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  handler: (event: KeyboardEvent) => void;
  description?: string;
}

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  );
};

/** Raccourcis clavier globaux (brief section 8). */
export function useHotkeys(hotkeys: Hotkey[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      for (const hotkey of hotkeys) {
        const ctrlNeeded = hotkey.ctrl ?? false;
        const ctrlPressed = event.ctrlKey || event.metaKey;
        if (
          event.key.toLowerCase() === hotkey.key.toLowerCase() &&
          ctrlNeeded === ctrlPressed &&
          (hotkey.shift ?? false) === event.shiftKey
        ) {
          event.preventDefault();
          hotkey.handler(event);
          return;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hotkeys, enabled]);
}
