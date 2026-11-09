import { errorMessage } from '@/shared/api/errors';
import { Button, Modal } from '@/shared/ui';

interface Props {
  title: string;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onClose: () => void;
}

export function WarehouseLookupNotice({
  title,
  loading,
  error,
  onRetry,
  onClose,
}: Props) {
  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
    >
      {loading ? (
        <p role="status">Đang tải danh sách kho…</p>
      ) : (
        <>
          <p role={error ? 'alert' : undefined}>
            {error
              ? errorMessage(error)
              : 'Chưa có kho hoạt động để tạo bản ghi.'}
          </p>

          <Button onClick={onRetry}>Tải lại</Button>
        </>
      )}
    </Modal>
  );
}