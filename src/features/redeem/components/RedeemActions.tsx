import { Button, Callout } from '@/shared/ui';
import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useRedeemStep } from '../hooks';
import type { Redemption, RedeemStep } from '../types';
import { allowedRedeemSteps } from '../policy';

/** Workflow: Requested → (Duyệt | Từ chối) → Approved → Delivered → Done. */
export function RedeemActions({ x, size = 'sm' }: { x: Redemption; size?: 'sm' | 'md' }) {
  const step = useRedeemStep();
  const { user } = useAuth();
  if (!can(user, 'redeem.manage')) return null;
  const actions = allowedRedeemSteps(x.status);
  const labels: Record<RedeemStep, string> = { approve: 'Duyệt', reject: 'Từ chối', deliver: 'Ghi nhận giao quà', complete: 'Hoàn tất' };
  const run = (s: RedeemStep) => {
    if (!actions.includes(s) || step.isPending) return;
    step.mutate({ code: x.code, step: s });
  };
  return (
    <>
      {actions.map(action => <Button key={action} size={size}
        variant={action === 'reject' ? 'danger' : action === 'deliver' ? 'default' : 'primary'}
        disabled={step.isPending} onClick={() => run(action)}>{labels[action]}</Button>)}
      {step.error && <Callout tone="danger">{errorMessage(step.error)}</Callout>}
    </>
  );
}
