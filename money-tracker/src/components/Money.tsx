'use client';

import { rp, rpShort } from '@/lib/format';
import { useApp } from './AppContext';
import { IEye, IEyeOff } from './icons';

/** An amount that blurs when the eye toggle hides balances. */
export function Money({ value, short, sign, className }: { value: number; short?: boolean; sign?: boolean; className?: string }) {
  return <span className={`money num ${className ?? ''}`}>{short ? rpShort(value) : rp(value, { sign })}</span>;
}

export function HideToggle() {
  const { hidden, toggleHidden } = useApp();
  return (
    <button type="button" onClick={toggleHidden} aria-label={hidden ? 'Show amounts' : 'Hide amounts'} aria-pressed={hidden}>
      {hidden ? <IEyeOff /> : <IEye />}
    </button>
  );
}
