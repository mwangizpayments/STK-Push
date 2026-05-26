import { Badge } from '@/components/ui/badge';

const variants = {
  idle: 'secondary',
  pending: 'pending',
  success: 'success',
  failed: 'failed'
};

export function StatusPill({ status }) {
  return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
}

