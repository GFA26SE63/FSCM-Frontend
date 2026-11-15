import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { FormDialog, FormField, TextArea } from '@/shared/ui';
import { useComplaint, useDecideComplaint } from '../hooks';
import type { ComplaintDecision } from '../api';

const MIN_REASON_LENGTH = 5;

const reasonLabel = (decision: string) =>
  decision === 'reject' ? 'Lý do từ chối'
    : decision === 'requestEvidence' ? 'Bằng chứng cần bổ sung'
    : 'Căn cứ chấp nhận / ghi chú';

const reasonPlaceholder = (decision: string) =>
  decision === 'reject' ? 'Nêu rõ lý do từ chối khiếu nại'
    : decision === 'requestEvidence' ? 'Nêu rõ bằng chứng Retailer cần bổ sung (ảnh tem, biên bản giao nhận…)'
    : 'Nêu căn cứ chấp nhận khiếu nại';

/**
 * F62 review dialog. Admin approves (settled in money) or rejects; Operator can only ask the
 * retailer for more evidence.
 */
export function ResolveDialog({ code, onClose }: { code: string | null; onClose: () => void }) {
  const decide = useDecideComplaint();
  const query = useComplaint(code ?? '');
  const { user } = useAuth();
  const mayDecide = can(user, 'complaints.decide');
  const claim = query.data;
  if (!code || !claim) return null;
  if (claim.status === 'Approved' && !mayDecide) return null;
  const options = claim?.status === 'Approved' ? [{value:'approve',label:'Chốt tài chính cho yêu cầu đã duyệt'}] : [
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
      title={`Xử lý yêu cầu ${code}`}
      submitLabel="Xác nhận"
      initial={{ decision: claim.status === 'Approved' ? 'approve' : 'requestEvidence', result: '', approvedQuantity: claim.approvedQuantity ?? claim.requestedQuantity ?? claim.expectedQuantity - claim.actualQuantity,
        settlementMethod: claim.approvedSettlementMethod ?? claim.settlementMethod ?? 'DebtOffset', waive: false, waiverReason: '' }}
      fields={[
        { key: 'decision', type: 'select', required: true, label: 'Quyết định', options },
        { key: 'approvedQuantity', type: 'number', required: true, label: 'Số thùng được duyệt', visible: v => v.decision === 'approve',
          validate: value => !Number.isInteger(Number(value)) || Number(value) <= 0 || Number(value) > (claim.requestedQuantity ?? claim.expectedQuantity - claim.actualQuantity) ? 'Số nguyên dương, không vượt số yêu cầu.' : undefined },
        { key: 'settlementMethod', type: 'select', label: 'Phương án xác nhận', required: true, visible: v => v.decision === 'approve',
          options: [{value:'DebtOffset',label:'Cấn trừ công nợ'}, {value:'CashRefund',label:'Hoàn tiền'},
            ...(claim.requestType === 'DamagedCollection' ? [{value:'None',label:'Chỉ thu hồi, không bồi hoàn'}] : [])] },
        { key: 'policy', type: 'info', label: 'Đối soát', visible: v => v.decision === 'approve',
          info: () => 'Giảm nợ trong chính đơn gốc trước; phần tiền đã thu thừa tự tạo phiếu hoàn. Yêu cầu có xử lý hàng chỉ chốt tiền sau xác nhận thực tế.' },
        { key: 'waive', type: 'check', label: 'Miễn xử lý hàng thực tế và chốt tài chính ngay',
          visible: v => v.decision === 'approve' && (claim.requestType !== 'Complaint' || !!claim.requiresCollection) },
        { key: 'waiverReason', type: 'textarea', required: true, label: 'Lý do miễn xử lý hàng', visible: v => v.decision === 'approve' && !!v.waive },
        {
          key: 'result',
          type: 'custom',
          required: true,
          label: 'Lý do / ghi chú',
          // Custom so the message names what is missing for the chosen decision, and so a
          // whitespace-only or one-word reason is not accepted.
          validate: (value, v) => {
            const text = String(value ?? '').trim();
            if (text.length >= MIN_REASON_LENGTH) return undefined;
            const what = v.decision === 'reject' ? 'lý do từ chối'
              : v.decision === 'requestEvidence' ? 'nội dung bằng chứng cần bổ sung'
              : 'căn cứ chấp nhận';
            return text.length === 0
              ? `Vui lòng nhập ${what}.`
              : `Vui lòng nhập ${what} rõ ràng (tối thiểu ${MIN_REASON_LENGTH} ký tự).`;
          },
          render: (v, set, error) => (
            <FormField label={reasonLabel(String(v.decision))} required error={error}
              hint={!error ? 'Nội dung này được gửi cho Retailer và lưu vào lịch sử xử lý.' : undefined}>
              <TextArea value={v.result ?? ''} invalid={!!error} onChange={(e) => set('result', e.target.value)}
                placeholder={reasonPlaceholder(String(v.decision))} />
            </FormField>
          ),
        },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        await decide.mutateAsync({ code, id: claim.id, expectedVersion: claim.version, decision: v.decision as ComplaintDecision, text: String(v.result).trim(),
          ...(v.decision === 'approve' ? { approvedQuantity: Number(v.approvedQuantity), settlementMethod: String(v.settlementMethod),
            expectedVersion: claim.version, waivePhysicalHandling: !!v.waive, waiverReason: String(v.waiverReason).trim() } : {}) });
        onClose();
      }}
    />
  );
}
