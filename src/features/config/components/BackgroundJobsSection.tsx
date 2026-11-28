import { useState } from 'react';
import { Button, Callout, Card, FormField, Input } from '@/shared/ui';
import { useSaveBackgroundJobs } from '../hooks';
import type { BackgroundJobs } from '../types';

function EnabledSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="check" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /> Bật tác vụ
  </label>;
}

export function BackgroundJobsSection({ current, group }: { current: BackgroundJobs; group: 'batches' | 'payment' }) {
  const [draft, setDraft] = useState(current);
  const [pollSeconds, setPollSeconds] = useState(String(current.inventoryOutbox.pollIntervalSeconds));
  const [batchSize, setBatchSize] = useState(String(current.inventoryOutbox.batchSize));
  const [pollMinutes, setPollMinutes] = useState(String(current.orderDeadline.pollIntervalMinutes));
  const [windowDays, setWindowDays] = useState(String(current.orderDeadline.prepaidPaymentWindowDays));
  const save = useSaveBackgroundJobs();
  const integerInRange = (value: string, min: number, max: number) =>
    value.trim() !== '' && Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max;
  let validZone = true;
  try { new Intl.DateTimeFormat('vi-VN', { timeZone: draft.dateTracker.timeZone }).format(); }
  catch { validZone = false; }
  const valid = group === 'payment' ? integerInRange(pollMinutes, 1, 60) && integerInRange(windowDays, 1, 30)
    : validZone && draft.dateTracker.timeZone.trim() !== ''
    && /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.dateTracker.runAtLocalTime)
    && integerInRange(pollSeconds, 1, 300) && integerInRange(batchSize, 1, 500);

  return <div className="stack">
    <Callout tone="info">Các thay đổi được lưu có phiên bản trong database và áp dụng trong vòng 15 giây, không cần khởi động lại backend. Tắt tác vụ không hủy lượt đang chạy.</Callout>
    {group === 'batches' && <>
    <Card title="Kiểm tra hạn sử dụng lô hàng">
      <EnabledSwitch checked={draft.dateTracker.enabled} onChange={enabled => setDraft({ ...draft, dateTracker: { ...draft.dateTracker, enabled } })} />
      <div className="form-grid cols-2">
        <FormField label="Múi giờ chạy tác vụ" hint="Ví dụ: Asia/Ho_Chi_Minh. Ngày nghiệp vụ HSD vẫn theo giờ Việt Nam.">
          <Input value={draft.dateTracker.timeZone} onChange={e => setDraft({ ...draft, dateTracker: { ...draft.dateTracker, timeZone: e.target.value } })} />
        </FormField>
        <FormField label="Giờ chạy hằng ngày" hint="Định dạng HH:mm; nếu bỏ lỡ giờ chạy, tác vụ chạy bù khi được bật.">
          <Input type="time" value={draft.dateTracker.runAtLocalTime} onChange={e => setDraft({ ...draft, dateTracker: { ...draft.dateTracker, runAtLocalTime: e.target.value } })} />
        </FormField>
      </div>
    </Card>
    <Card title="Thông báo lô hàng hết hạn">
      <EnabledSwitch checked={draft.inventoryOutbox.enabled} onChange={enabled => setDraft({ ...draft, inventoryOutbox: { ...draft.inventoryOutbox, enabled } })} />
      <div className="form-grid cols-2">
        <FormField label="Chu kỳ kiểm tra (giây)" hint="Từ 1 đến 300 giây."><Input inputMode="numeric" value={pollSeconds} onChange={e => setPollSeconds(e.target.value)} /></FormField>
        <FormField label="Số thông điệp tối đa mỗi lượt" hint="Từ 1 đến 500."><Input inputMode="numeric" value={batchSize} onChange={e => setBatchSize(e.target.value)} /></FormField>
      </div>
    </Card>
    <Card title="Phục hồi phân bổ bị gián đoạn">
      <EnabledSwitch checked={draft.allocationRecovery.enabled} onChange={enabled => setDraft({ ...draft, allocationRecovery: { enabled } })} />
      <p>Tự thử lại các lần phân bổ bị gián đoạn. Chu kỳ kiểm tra là 1 phút.</p>
    </Card>
    </>}
    {group === 'payment' && <Card title="Hạn báo giá và thanh toán trả trước">
      <EnabledSwitch checked={draft.orderDeadline.enabled} onChange={enabled => setDraft({ ...draft, orderDeadline: { ...draft.orderDeadline, enabled } })} />
      <div className="form-grid cols-2">
        <FormField label="Chu kỳ kiểm tra (phút)" hint="Từ 1 đến 60 phút."><Input inputMode="numeric" value={pollMinutes} onChange={e => setPollMinutes(e.target.value)} /></FormField>
        <FormField label="Thời gian chờ thanh toán trả trước (ngày)" hint="Từ 1 đến 30 ngày, tính từ khi chấp nhận báo giá."><Input inputMode="numeric" value={windowDays} onChange={e => setWindowDays(e.target.value)} /></FormField>
      </div>
      <Callout tone="info">Hạn này khác thời hạn link PayOS bên dưới. Thay đổi được dùng ở lượt quét tiếp theo cho các đơn đang chờ thanh toán; giảm hạn có thể khiến đơn bị hủy và trả tồn sớm hơn.</Callout>
    </Card>}
    {!valid && <Callout tone="danger">Kiểm tra múi giờ, giờ chạy và giới hạn số của từng trường.</Callout>}
    <Button variant="primary" disabled={!valid} loading={save.isPending} onClick={() => {
      if (!valid || save.isPending) return;
      save.mutate(group === 'batches' ? {
        dateTracker: draft.dateTracker,
        allocationRecovery: draft.allocationRecovery,
        inventoryOutbox: { ...draft.inventoryOutbox, pollIntervalSeconds: Number(pollSeconds), batchSize: Number(batchSize) },
      } : {
        orderDeadline: { ...draft.orderDeadline, pollIntervalMinutes: Number(pollMinutes), prepaidPaymentWindowDays: Number(windowDays) },
      });
    }}>{group === 'batches' ? 'Lưu cấu hình quản lý lô hàng' : 'Lưu hạn báo giá và thanh toán'}</Button>
  </div>;
}
