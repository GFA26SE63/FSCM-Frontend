import { Button, Callout, Fields, Modal, StatusChip } from '@/shared/ui';
import { formatNumber } from '@/shared/lib';
import type { Gift, GiftProgram } from '../types';

export function GiftDetailDialog({ gift, program, loading, error, onRetry, onClose }: {
  gift: Gift; program?: GiftProgram; loading: boolean; error: unknown;
  onRetry: () => void; onClose: () => void;
}) {
  return <Modal open width={720} title={`Chi tiết quà ${gift.code}`} onClose={onClose}>
    {gift.imageUrl && <img src={gift.imageUrl} alt={gift.name}
      style={{ display: 'block', width: 160, height: 160, objectFit: 'contain', margin: '0 auto 16px' }} />}
    {error != null && <Callout tone="danger">Không tải được thông tin chương trình khách hàng thân thiết.
      <Button size="sm" onClick={onRetry}>Thử lại</Button>
    </Callout>}
    <Fields items={[
      { label: 'Mã quà', value: gift.code },
      { label: 'Tên quà', value: gift.name },
      { label: 'Chương trình khách hàng thân thiết', value: program ? `${program.code} · ${program.name}`
        : loading ? 'Đang tải…' : `Mã định danh: ${gift.loyaltyProgramId}` },
      { label: 'Trạng thái', value: <StatusChip domain="active" value={gift.status} /> },
      { label: 'Điểm đổi cho 1 quà', value: formatNumber(gift.points) },
      { label: 'Còn có thể cấp', value: gift.stock === null ? 'Không giới hạn' : formatNumber(gift.stock) },
      { label: 'Đã đổi', value: gift.redeemed === null ? 'Chưa xác định' : formatNumber(gift.redeemed) },
      { label: 'Mô tả', value: gift.description || '—' },
    ]} />
  </Modal>;
}
