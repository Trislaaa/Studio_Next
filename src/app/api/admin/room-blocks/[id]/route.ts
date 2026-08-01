import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { broadcastInventory } from '@/lib/realtime';

// DELETE /api/admin/room-blocks/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deleted = await prisma.roomBlock.delete({ where: { id } });
    await broadcastInventory({
      type: 'inventory:block:deleted',
      payload: { roomId: deleted.roomId, startDate: deleted.startDate.toISOString(), endDate: deleted.endDate.toISOString() }
    });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting room block:', error);
    return NextResponse.json({ error: 'Failed to delete room block' }, { status: 500 });
  }
}
