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
      submitLabel="Ghi nhận quyết định"
      initial={{ approved: 'true', result: '' }}
      fields={[
        { key: 'approved', type: 'select', required: true, label: 'Quyết định', options: [{ value: 'true', label: 'Duyệt khiếu nại' }, { value: 'false', label: 'Từ chối khiếu nại' }] },
        { key: 'result', type: 'textarea', required: true, label: 'Lý do / kết quả xử lý', placeholder: 'Nêu rõ căn cứ và hướng xử lý; hoàn tiền thực tế do F101 xác minh riêng.' },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        await resolve.mutateAsync({ code: code!, result: v.result, approved: String(v.approved) === 'true' });
        onClose();
      }}
    />
  );
}
