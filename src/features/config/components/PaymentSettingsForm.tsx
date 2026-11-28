import { useState } from 'react';
import { Button, Callout, Card, FormField, Input, ToggleSwitch } from '@/shared/ui';
import { useSaveConfigurationEntries } from '../hooks';
import type { BackgroundJobs, SystemSettings } from '../types';
import { integerInRange } from '../validation';

export function PaymentSettingsForm({ deadline, linkLifetime }: {
  deadline: BackgroundJobs['orderDeadline']; linkLifetime: SystemSettings['payOsLinkLifetimeMinutes'];
}) {
  const [enabled, setEnabled] = useState(deadline.enabled);
  const [pollMinutes, setPollMinutes] = useState(String(deadline.pollIntervalMinutes));
  const [windowDays, setWindowDays] = useState(String(deadline.prepaidPaymentWindowDays));
  const [linkMinutes, setLinkMinutes] = useState(String(linkLifetime));
  const save = useSaveConfigurationEntries();
  const valid = integerInRange(pollMinutes, 1, 60) && integerInRange(windowDays, 1, 30) && integerInRange(linkMinutes, 0, 10080);
  const submit = () => {
    if (!valid || save.isPending) return;
    save.mutate([
      { key: 'jobs.order_deadline', value: { enabled, pollIntervalMinutes: Number(pollMinutes), prepaidPaymentWindowDays: Number(windowDays) } },
      { key: 'payment.payos_link_lifetime_minutes', value: Number(linkMinutes) },
    ]);
  };
  return <div className="config-sections">
    <Card title="Báo giá & Thanh toán">
      <div className="config-section-body">
        <ToggleSwitch label="Tự động kiểm tra hạn báo giá và thanh toán trả trước" checked={enabled} onChange={setEnabled} />
        <div className="config-fields config-fields--three">
          <FormField label="Chu kỳ kiểm tra (phút)" hint="Từ 1 đến 60 phút."><Input inputMode="numeric" value={pollMinutes} onChange={e => setPollMinutes(e.target.value)} /></FormField>
          <FormField label="Thời gian chờ thanh toán trả trước (ngày)" hint="Từ 1 đến 30 ngày, tính từ lúc chấp nhận báo giá."><Input inputMode="numeric" value={windowDays} onChange={e => setWindowDays(e.target.value)} /></FormField>
          <FormField label="Thời hạn link thanh toán PayOS (phút)" hint="Từ 0 đến 10080 phút; 0 = không đặt hạn link."><Input inputMode="numeric" value={linkMinutes} onChange={e => setLinkMinutes(e.target.value)} /></FormField>
        </div>
        <Callout tone="info">Hạn thanh toán đơn khác thời hạn link PayOS. Tạo lại link không gia hạn đơn. Thay đổi số ngày chờ áp dụng ở lượt quét tiếp theo cho đơn đang chờ; giảm hạn có thể khiến đơn bị hủy và trả tồn sớm hơn.</Callout>
        <p className="muted small">Thời hạn link áp dụng cho link mới của đơn trả trước và thanh toán công nợ. Tắt tác vụ không hủy lượt đang chạy.</p>
        {!valid && <Callout tone="danger">Kiểm tra chu kỳ từ 1–60 phút, thời gian chờ từ 1–30 ngày và thời hạn link từ 0–10080 phút. Các giá trị phải là số nguyên.</Callout>}
      </div>
    </Card>
    <div className="config-actions">
      <Button variant="primary" disabled={!valid} loading={save.isPending} onClick={submit}>Lưu cấu hình báo giá và thanh toán</Button>
    </div>
  </div>;
}
