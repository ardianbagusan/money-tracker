import Link from 'next/link';
import { getEmailImports } from '@/lib/data';
import { ImportsView } from './ImportsView';

export default async function ImportsPage() {
  const items = await getEmailImports();
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">From email</h1>
          <p className="page-sub">Transactions found in your Gmail. Check each one, then add or dismiss it. Nothing is added until you confirm.</p>
        </div>
        <div className="head-actions"><Link className="btn" href="/settings#gmail">Setup</Link></div>
      </div>
      <ImportsView items={items} />
    </>
  );
}
