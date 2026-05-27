import { Badge } from '@/components/ui/badge';

const variants = {
  created: 'created',
  idle: 'secondary',
  pending: 'pending',
  pending_pin: 'pending',
  processing: 'processing',
  success: 'success',
  failed: 'failed',
  timeout: 'timeout',
  cancelled: 'cancelled'
};

const labels = {
  created: 'created',
  idle: 'ready',
  pending: 'pending',
  pending_pin: 'waiting PIN',
  processing: 'processing',
  success: 'success',
  failed: 'failed',
  timeout: 'timeout',
  cancelled: 'cancelled'
};

export function StatusPill({ status }) {
  return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
}
