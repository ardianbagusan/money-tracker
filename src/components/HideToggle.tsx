'use client';

import { useApp } from './AppContext';
import { IEye, IEyeOff } from './icons';

export function HideToggle() {
  const { hidden, toggleHidden } = useApp();
  return (
    <button type="button" onClick={toggleHidden} aria-label={hidden ? 'Show amounts' : 'Hide amounts'} aria-pressed={hidden}>
      {hidden ? <IEyeOff /> : <IEye />}
    </button>
  );
}
