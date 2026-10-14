'use client';

import { rp, rpShort } from '@/lib/format';

/** An amount that blurs when the eye toggle hides balances. */
export function Money({ value, short, sign, className }: { value: number; short?: boolean; sign?: boolean; className?: string }) {
  return <span className={`money num ${className ?? ''}`}>{short ? rpShort(value) : rp(value, { sign })}</span>;
}
