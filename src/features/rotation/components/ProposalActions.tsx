import { useState } from 'react';
import { Button, FormDialog } from '@/shared/ui';
import { useApproveProposal, useSkipProposal, useUpdateProposalQty } from '../hooks';
import type { RotationProposal } from '../types';

/** Duyệt / Sửa SL / Bỏ qua for a proposal row (only while status = Proposed). */
export function ProposalActions({ p, size = 'sm' }: { p: RotationProposal; size?: 'sm' | 'md' }) {
  const approve = useApproveProposal();
  const skip = useSkipProposal();
  const update = useUpdateProposalQty();
  const [edit, setEdit] = useState(false);
  if (p.status !== 'Proposed') return null;
  return (
    <>
      <Button size={size} variant="primary" loading={approve.isPending} onClick={() => approve.mutate(p.id)}>Duyệt</Button>
      <Button size={size} onClick={() => setEdit(true)}>Sửa SL</Button>
      <Button size={size} variant="danger" loading={skip.isPending} onClick={() => skip.mutate(p.id)}>Bỏ qua</Button>
      <FormDialog
        open={edit}
        width={460}
        columns={1}
        title={`Sửa số lượng · ${p.batchCode}`}
        submitLabel="Lưu số lượng"
        initial={{ qty: p.qty }}
        note={`Tối thiểu 10 thùng, tối đa ${p.maxQty} thùng (năng lực nhận của kho đích).`}
        fields={[
          { key: 'info', type: 'info', label: 'Tuyến', info: () => `${p.fromWarehouseName} → ${p.toWarehouseName}` },
          { key: 'qty', type: 'number', required: true, label: 'Số thùng', validate: (v) => (Number(v) < 10 ? 'Tối thiểu 10 thùng.' : Number(v) > p.maxQty ? `Tối đa ${p.maxQty} thùng.` : undefined) },
        ]}
        onClose={() => setEdit(false)}
        onSubmit={async (v) => {
          await update.mutateAsync({ id: p.id, qty: Number(v.qty) });
          setEdit(false);
        }}
      />
    </>
  );
}
