import { db } from '@/lib/db';

// Receipt photos (/api/image/receipt/<transaction id>) and food stickers (/api/image/cutout/<id>).
// Only the signed-in person's own database is read.
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  let sql;
  try {
    sql = await db();
  } catch {
    return new Response('Not signed in', { status: 401 });
  }
  const { kind, id } = await params;
  const n = Number(id) || 0;
  if (kind === 'receipt') {
    const [r] = await sql`select mime, data from receipts where transaction_id = ${n}`;
    if (!r) return new Response('Not found', { status: 404 });
    return new Response(new Uint8Array(r.data), { headers: { 'Content-Type': r.mime, 'Cache-Control': 'private, max-age=86400' } });
  }
  if (kind === 'cutout') {
    const [r] = await sql`select image from food_cutouts where id = ${n}`;
    if (!r) return new Response('Not found', { status: 404 });
    const b: Buffer = r.image;
    const mime = b.subarray(0, 4).toString('ascii') === 'RIFF' ? 'image/webp' : 'image/png';
    return new Response(new Uint8Array(b), { headers: { 'Content-Type': mime, 'Cache-Control': 'private, max-age=604800, immutable' } });
  }
  return new Response('Not found', { status: 404 });
}
