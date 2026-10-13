import { useState } from 'react';
import { Button, ConfirmDialog, FormDialog } from '@/shared/ui';
import { useApproveRegistration, useRejectRegistration } from '../hooks';

/** Duyệt / Từ chối for a Sales registration (KB-xxxx). Approve issues the 8-digit retailer code. */
export function RegistrationActions({ code, size = 'sm', onDone }: { code: string; size?: 'sm' | 'md'; onDone?: (retailerCode?: string) => void }) {
  const approve = useApproveRegistration();
  const reject = useRejectRegistration();
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null);
  return (
    <>
      <Button size={size} variant="primary" onClick={() => setMode('approve')}>Duyệt</Button>
      <Button size={size} variant="danger" onClick={() => setMode('reject')}>Từ chối</Button>
      <ConfirmDialog
        open={mode === 'approve'}
        title={`Duyệt khai báo ${code}`}
        message="Hệ thống cấp mã retailer 8 chữ số, gán nhóm Sales của người khai báo và gửi thông báo cho Sales."
        confirmLabel="Duyệt khai báo"
        onClose={() => setMode(null)}
        onConfirm={async () => {
          const r = await approve.mutateAsync(code);
          setMode(null);
          onDone?.(r.retailer.code);
        }}
      />
      <FormDialog
        open={mode === 'reject'}
        width={520}
        columns={1}
        danger
        title={`Từ chối khai báo ${code}`}
        submitLabel="Từ chối"
        initial={{ reason: '' }}
        fields={[{ key: 'reason', type: 'textarea', required: true, label: 'Lý do từ chối (bắt buộc)' }]}
        onClose={() => setMode(null)}
        onSubmit={async (v) => {
          await reject.mutateAsync({ code, reason: v.reason });
          setMode(null);
          onDone?.();
        }}
      />
    </>
  );
}
