import type { Order, OrderStatus } from '@/lib/types';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  requested: 'Requested', accepted: 'Accepted', ready_for_pickup: 'Ready for pickup', completed: 'Completed',
  declined: 'Declined', cancelled: 'Cancelled', expired: 'Expired', disputed: 'Under review',
};

export const STATUS_TONE: Record<OrderStatus, 'neutral' | 'eco' | 'warning' | 'danger' | 'primary'> = {
  requested: 'warning', accepted: 'primary', ready_for_pickup: 'primary', completed: 'eco',
  declined: 'neutral', cancelled: 'neutral', expired: 'neutral', disputed: 'danger',
};

export const STEPS: OrderStatus[] = ['requested', 'accepted', 'ready_for_pickup', 'completed'];

// What the current user should do next, in plain words.
export function nextStep(o: Order): string {
  const owner = o.role === 'owner';
  switch (o.status) {
    case 'requested': return owner ? 'Accept or decline this request.' : 'Waiting for the owner to respond.';
    case 'accepted': return owner ? 'Agree a time in chat, then mark it ready for pickup.' : 'Agree a pickup time with the owner in chat.';
    case 'ready_for_pickup': return owner ? 'At handover, enter the 6-digit code the requester shows you.' : 'At handover, show your pickup code to the owner.';
    case 'completed': return 'All done. Thanks for sharing!';
    case 'disputed': return 'Our team is reviewing this exchange.';
    default: return 'This exchange is closed.';
  }
}
