import { Button } from '@/shared/ui';
import { useRedeemStep } from '../hooks';
import type { Redemption } from '../types';

/** Workflow: Requested → (Duyệt | Từ chối) → Approved → Delivered → Done. */
export function RedeemActions({ x, size = 'sm' }: { x: Redemption; size?: 'sm' | 'md' }) {
  const step = useRedeemStep();
  const run = (s: 'approve' | 'reject' | 'deliver' | 'complete') => step.mutate({ code: x.code, step: s });
  return (
    <>
      {x.status === 'Requested' && (
        <>
          <Button size={size} variant="primary" disabled={step.isPending} onClick={() => run('approve')}>Duyệt</Button>
          <Button size={size} variant="danger" disabled={step.isPending} onClick={() => run('reject')}>Từ chối</Button>
        </>
      )}
      {x.status === 'Approved' && (
        <>
          <Button size={size} disabled={step.isPending} onClick={() => run('deliver')}>Giao quà</Button>
          <Button size={size} variant="primary" disabled={step.isPending} onClick={() => run('complete')}>Hoàn tất</Button>
        </>
      )}
      {x.status === 'Delivered' && <Button size={size} variant="primary" disabled={step.isPending} onClick={() => run('complete')}>Hoàn tất</Button>}
    </>
  );
}
