import type { ReactNode } from 'react';
import { statusLabel, type StatusDomain } from '../lib/status';

export type Tone = 'info' | 'ok' | 'success' | 'violet' | 'danger' | 'warn' | 'neutral' | 'dark' | 'deep';

/** Label → tone, ported from prototype chipStyle(). Keeps one colour language across all screens. */
const toneByLabel: [string[], Tone][] = [
  [['Chờ duyệt', 'Nháp', 'Gợi ý', 'Chờ giao', 'Đề xuất', 'Chưa thu', 'Bổ sung', 'Chưa pick'], 'info'],
  [['Đã duyệt', 'Đã xuất kho', 'Đang chạy', 'Hoạt động', 'Bình thường', 'Đã xuất', 'Đã nhập', 'Đã xử lý', 'Đã tiêu hủy', 'Đã publish', 'Đã nhận', 'Đang áp dụng', 'Đã thu đủ', 'Hoàn tất', 'Đạt', 'A'], 'ok'],
  [['Kho tổng'], 'deep'],
  [['B', 'Inactive', 'Kho vùng', 'Bỏ qua', 'Online'], 'neutral'],
  [['Đang giao', 'Đang pick', 'Đang soạn hàng', 'Đang vận chuyển', 'Luân chuyển cận hạn', 'Đang giao quà'], 'violet'],
  [['Đã giao'], 'success'],
  [['Bị từ chối', 'Hết hạn', 'Đã khóa', 'Quá hạn', 'Chưa đạt', 'Từ chối', 'Đã hủy'], 'danger'],
  [['Cận hạn', 'Tạm dừng', 'Chờ xử lý', 'Tạm ngừng', 'C', 'Hết hiệu lực', 'Gợi ý giảm giá', 'Không có kho đích', 'Bảo trì', 'Tạm nghỉ'], 'warn'],
  [['Offline'], 'dark'],
];

export const toneOf = (label: string): Tone => toneByLabel.find(([labels]) => labels.includes(label))?.[1] ?? 'neutral';

export function Chip({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`chip tone-${tone}`} title={title}>
      {children}
    </span>
  );
}

/** <StatusChip domain="order" value="Pending" /> → blue "Chờ duyệt". Pass label directly with domain omitted. */
export function StatusChip({ domain, value }: { domain?: StatusDomain; value: string }) {
  const label = domain ? statusLabel(domain, value) : value;
  return <Chip tone={toneOf(label)}>{label}</Chip>;
}
