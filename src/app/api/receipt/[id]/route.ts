import { db } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let sql;
  try {
    sql = await db();
  } catch {
    return new Response('Not signed in', { status: 401 });
  }
  const { id } = await params;
  const [r] = await sql`select mime, data from receipts where transaction_id = ${Number(id) || 0}`;
  if (!r) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(r.data), {
    headers: { 'Content-Type': r.mime, 'Cache-Control': 'private, max-age=86400' },
  });
}
