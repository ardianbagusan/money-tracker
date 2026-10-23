'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IX } from './icons';

export function Sheet({
  title, onClose, children, footer, wide, left,
}: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; left?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus]');
    // Only autofocus on devices with a real keyboard so phones don't pop the keyboard open.
    if (first && window.matchMedia('(pointer: fine)').matches) first.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={ref} className={`sheet${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grab" />
        <div className="sheet-head">
          {left}
          <h2 style={{ flex: 1 }}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IX />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}
