import { useState } from 'react';
import { Button, Callout, Card, FormField, Input, Select, ToggleSwitch } from '@/shared/ui';
import { useSaveBackgroundJobs } from '../hooks';
import type { BackgroundJobs } from '../types';
import { integerInRange } from '../validation';

const timeZones = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Việt Nam — Asia/Ho_Chi_Minh' },
  { value: 'Asia/Bangkok', label: 'Thái Lan — Asia/Bangkok' },
  { value: 'Asia/Singapore', label: 'Singapore — Asia/Singapore' },
  { value: 'Asia/Shanghai', label: 'Trung Quốc — Asia/Shanghai' },
  { value: 'Asia/Tokyo', label: 'Nhật Bản — Asia/Tokyo' },
  { value: 'Asia/Seoul', label: 'Hàn Quốc — Asia/Seoul' },
  { value: 'Asia/Kolkata', label: 'Ấn Độ — Asia/Kolkata' },
  { value: 'Asia/Dubai', label: 'Dubai — Asia/Dubai' },
  { value: 'Australia/Sydney', label: 'Sydney — Australia/Sydney' },
  { value: 'UTC', label: 'Giờ phối hợp quốc tế — UTC' },
  { value: 'Europe/London', label: 'London — Europe/London' },
  { value: 'Europe/Paris', label: 'Paris — Europe/Paris' },
  { value: 'America/New_York', label: 'New York — America/New_York' },
  { value: 'America/Los_Angeles', label: 'Los Angeles — America/Los_Angeles' },
];

export function BackgroundJobsSection({ current }: { current: BackgroundJobs }) {
  const [draft, setDraft] = useState(current);
  const [pollSeconds, setPollSeconds] = useState(String(current.inventoryOutbox.pollIntervalSeconds));
  const [batchSize, setBatchSize] = useState(String(current.inventoryOutbox.batchSize));
  const save = useSaveBackgroundJobs();
  let validZone = true;
  try { new Intl.DateTimeFormat('vi-VN', { timeZone: draft.dateTracker.timeZone }).format(); }
  catch { validZone = false; }
  const options = timeZones.some(zone => zone.value === current.dateTracker.timeZone) ? timeZones
    : [{ value: current.dateTracker.timeZone, label: current.dateTracker.timeZone }, ...timeZones];
  const valid = validZone && draft.dateTracker.timeZone.trim() !== ''
    && /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.dateTracker.runAtLocalTime)
    && integerInRange(pollSeconds, 1, 300) && integerInRange(batchSize, 1, 500);
  return <div className="config-sections">
    <Card title="Kiểm tra hạn sử dụng lô hàng">
      <div className="config-section-body">
        <ToggleSwitch label="Bật kiểm tra hạn sử dụng lô hàng" checked={draft.dateTracker.enabled} onChange={enabled => setDraft({ ...draft, dateTracker: { ...draft.dateTracker, enabled } })} />
        <div className="config-fields config-fields--two">
          <FormField label="Múi giờ chạy tác vụ" hint="Ngày nghiệp vụ HSD vẫn tính theo giờ Việt Nam.">
            <Select options={options} value={draft.dateTracker.timeZone} onChange={e => setDraft({ ...draft, dateTracker: { ...draft.dateTracker, timeZone: e.target.value } })} />
          </FormField>
          <FormField label="Giờ chạy hằng ngày" hint="Định dạng HH:mm; tác vụ chạy bù nếu bỏ lỡ giờ chạy.">
            <Input type="time" value={draft.dateTracker.runAtLocalTime} onChange={e => setDraft({ ...draft, dateTracker: { ...draft.dateTracker, runAtLocalTime: e.target.value } })} />
          </FormField>
        </div>
      </div>
    </Card>
    <Card title="Thông báo lô hàng hết hạn">
      <div className="config-section-body">
        <ToggleSwitch label="Bật thông báo lô hàng hết hạn" checked={draft.inventoryOutbox.enabled} onChange={enabled => setDraft({ ...draft, inventoryOutbox: { ...draft.inventoryOutbox, enabled } })} />
        <div className="config-fields config-fields--two">
          <FormField label="Chu kỳ kiểm tra (giây)" hint="Từ 1 đến 300 giây."><Input inputMode="numeric" value={pollSeconds} onChange={e => setPollSeconds(e.target.value)} /></FormField>
          <FormField label="Số thông điệp tối đa mỗi lượt" hint="Từ 1 đến 500."><Input inputMode="numeric" value={batchSize} onChange={e => setBatchSize(e.target.value)} /></FormField>
        </div>
      </div>
    </Card>
    <Card title="Phục hồi phân bổ bị gián đoạn">
      <div className="config-section-body">
        <ToggleSwitch label="Bật phục hồi phân bổ bị gián đoạn" checked={draft.allocationRecovery.enabled} onChange={enabled => setDraft({ ...draft, allocationRecovery: { enabled } })} />
        <p className="muted small">Tự thử lại các lần phân bổ bị gián đoạn, chu kỳ kiểm tra 1 phút.</p>
      </div>
    </Card>
    {!valid && <Callout tone="danger">Kiểm tra múi giờ, giờ chạy và giới hạn số của từng trường.</Callout>}
    <div className="config-actions">
      <Button variant="primary" disabled={!valid} loading={save.isPending} onClick={() => {
        if (!valid || save.isPending) return;
        save.mutate({
          dateTracker: draft.dateTracker, allocationRecovery: draft.allocationRecovery,
          inventoryOutbox: { ...draft.inventoryOutbox, pollIntervalSeconds: Number(pollSeconds), batchSize: Number(batchSize) },
        });
      }}>Lưu cấu hình quản lý lô hàng</Button>
    </div>
  </div>;
}
