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
      submitLabel="Xác nhận đã xử lý"
      initial={{ result: '' }}
      fields={[{ key: 'result', type: 'textarea', required: true, label: 'Kết quả xử lý', placeholder: 'Ví dụ: Đổi 2 thùng hàng lỗi, giao bù trong chuyến sáng mai' }]}
      onClose={onClose}
      onSubmit={async (v) => {
        await resolve.mutateAsync({ code: code!, result: v.result });
        onClose();
      }}
    />
  );
}
