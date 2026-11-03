import { FormDialog } from '@/shared/ui';
import { useResolveComplaint } from '../hooks';

export function ResolveDialog({ code, onClose }: { code: string | null; onClose: () => void }) {
  const resolve = useResolveComplaint();
  return (
    <FormDialog
      open={!!code}
      width={540}
      columns={1}
      title={`Xử lý khiếu nại ${code ?? ''}`}
      submitLabel="Xác nhận kết quả"
      initial={{ decision: 'approve', result: '' }}
      fields={[
        {
          key: 'decision',
          type: 'select',
          required: true,
          label: 'Quyết định',
          options: [
            { value: 'approve', label: 'Chấp nhận khiếu nại' },
            { value: 'reject', label: 'Từ chối – Retailer có thể bổ sung và gửi lại' },
          ],
        },
        {
          key: 'result',
          type: 'textarea',
          required: true,
          label: 'Kết quả / lý do',
          placeholder: 'Nêu rõ căn cứ chấp nhận hoặc lý do từ chối',
        },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        await resolve.mutateAsync({
          code: code!,
          result: v.result,
          approved: v.decision === 'approve',
        });
        onClose();
      }}
    />
  );
}
