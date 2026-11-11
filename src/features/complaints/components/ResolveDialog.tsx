import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { FormDialog } from '@/shared/ui';
import { useDecideComplaint } from '../hooks';
import type { ComplaintDecision } from '../api';

/**
 * F62 review dialog. Admin approves (settled in money) or rejects; Operator can only ask the
 * retailer for more evidence.
 */
export function ResolveDialog({ code, onClose }: { code: string | null; onClose: () => void }) {
  const decide = useDecideComplaint();
  const { user } = useAuth();
  const mayDecide = can(user, 'complaints.decide');
  const options = [
    { value: 'requestEvidence', label: 'Yêu cầu Retailer bổ sung bằng chứng' },
    ...(mayDecide
      ? [
          { value: 'approve', label: 'Chấp nhận – hoàn tiền / điều chỉnh tài chính (theo giá net của batch)' },
          { value: 'reject', label: 'Từ chối khiếu nại (bắt buộc nêu lý do)' },
        ]
      : []),
  ];
  return (
    <FormDialog
      open={!!code}
      width={560}
      columns={1}
      title={`Xử lý khiếu nại ${code ?? ''}`}
      submitLabel="Xác nhận"
      initial={{ decision: 'requestEvidence', result: '' }}
      fields={[
        { key: 'decision', type: 'select', required: true, label: 'Quyết định', options },
        {
          key: 'result',
          type: 'textarea',
          required: true,
          label: 'Lý do / ghi chú',
          placeholder: 'Nêu rõ bằng chứng cần bổ sung, căn cứ chấp nhận hoặc lý do từ chối',
        },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        await decide.mutateAsync({ code: code!, decision: v.decision as ComplaintDecision, text: String(v.result).trim() });
        onClose();
      }}
    />
  );
}
