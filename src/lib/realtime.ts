import PusherServer from 'pusher';

type InventoryEvent = {
  type: 'booking:created' | 'booking:updated' | 'booking:cancelled' | 'inventory:block:created' | 'inventory:block:deleted';
  payload: {
    roomId?: string;
    checkIn?: string;
    checkOut?: string;
    startDate?: string;
    endDate?: string;
  };
};

function getPusher() {
  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env as Record<string, string | undefined>;
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) {
    return null; // no-op when not configured
  }
  return new PusherServer({
    appId: PUSHER_APP_ID,
    key: PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: PUSHER_CLUSTER,
    useTLS: true,
  });
}

export async function broadcastInventory(event: InventoryEvent) {
  const pusher = getPusher();
  if (!pusher) return;
  try {
    await pusher.trigger('inventory', 'update', event);
  } catch (err) {
    console.warn('Pusher broadcast failed', err);
  }
}
