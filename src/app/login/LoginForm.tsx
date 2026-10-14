'use client';

import { useActionState, useState } from 'react';
import { login } from './actions';
import { IEye, IEyeOff } from '@/components/icons';

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="stack" style={{ gap: 12 }}>
      <label className="field">
        <span>Password</span>
        <div style={{ position: 'relative' }}>
          <input className="input" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required autoFocus
            style={{ paddingRight: 52 }} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
            style={{ position: 'absolute', right: 6, top: 4, width: 44, height: 44, border: 0, background: 'transparent', color: 'var(--muted)', display: 'grid', placeItems: 'center' }}>
            {show ? <IEyeOff width={20} /> : <IEye width={20} />}
          </button>
        </div>
      </label>
      {state?.error && <div className="error" role="alert">{state.error}</div>}
      <button className="btn btn-primary btn-block" disabled={pending}>{pending ? 'Checking…' : 'Sign in'}</button>
    </form>
  );
}
