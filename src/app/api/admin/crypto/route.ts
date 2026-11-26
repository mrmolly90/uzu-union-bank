import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getPrisma, syncDbToBlob, resetPrisma, unsnapshotBeforeRead, withUnsnapshotForce, withUnsnapshotNull } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/auth';

function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), getJwtSecret()) as any;
    if (!decoded || !decoded.role) return null;
    return decoded;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Proactive unsnapshot: download freshest Blob BEFORE reading
  await unsnapshotBeforeRead();

  const addresses = await withUnsnapshotForce('Admin Crypto GET', async () => {
    const prisma = await getPrisma();
    return prisma.cryptoAddress.findMany({
      orderBy: { symbol: 'asc' },
    });
  });

  return NextResponse.json(addresses);
}

export async function POST(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Download freshest Blob BEFORE the write so we operate on merged data
    await unsnapshotBeforeRead();

    const prisma = await getPrisma();
    const { symbol, name, network, address, minDeposit } = await req.json();

    if (!symbol || !name || !network || !address) {
      return NextResponse.json({ error: 'symbol, name, network, and address required' }, { status: 400 });
    }

    // Use upsert to avoid race condition between findUnique + create
    const created = await prisma.cryptoAddress.upsert({
      where: { symbol },
      update: {
        name,
        network,
        address,
        minDeposit: minDeposit || '',
        isActive: true,
      },
      create: {
        symbol,
        name,
        network,
        address,
        minDeposit: minDeposit || '',
      },
    });

    try {
      await syncDbToBlob();
      await resetPrisma();
    } catch (syncErr) {
      console.error('[Admin Crypto POST] Blob sync failed (non-fatal):', syncErr);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('[Admin Crypto POST]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const prisma = await getPrisma();
    const { id, symbol, name, network, address, minDeposit, isActive } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    // Use unsnapshot to verify the crypto address exists
    const existing = await withUnsnapshotNull('Admin Crypto PATCH', async () => {
      const p = await getPrisma();
      return p.cryptoAddress.findUnique({ where: { id } });
    });
    if (!existing) {
      return NextResponse.json({ error: 'Crypto address not found.' }, { status: 404 });
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (network !== undefined) data.network = network;
    if (address !== undefined) data.address = address;
    if (minDeposit !== undefined) data.minDeposit = minDeposit;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.cryptoAddress.update({
      where: { id },
      data,
    });

    await syncDbToBlob();
    await resetPrisma();

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[Admin Crypto PATCH]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
