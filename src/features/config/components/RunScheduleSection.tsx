import { useEffect, useState } from 'react';
import { Button, Callout, FormField, Input } from '@/shared/ui';
import { usePublishRunSchedule } from '../hooks';
import type { RunSchedule } from '../types';
import { validMinutes } from '../validation';

const normalizeSlots = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** Operational ETA configuration for the real-time allocation flow. */
export function RunScheduleSection({ current }: { current: RunSchedule }) {
  const [preparationMinutes, setPreparationMinutes] = useState(String(current.preparationMinutes));
  const [bufferMinutes, setBufferMinutes] = useState(String(current.bufferMinutes));
  const [dispatchSlots, setDispatchSlots] = useState(current.dispatchSlotsLocalTime.map((v) => v.slice(0, 5)).join(', '));
  const publish = usePublishRunSchedule();

  useEffect(() => {
    setPreparationMinutes(String(current.preparationMinutes));
    setBufferMinutes(String(current.bufferMinutes));
    setDispatchSlots(current.dispatchSlotsLocalTime.map((v) => v.slice(0, 5)).join(', '));
  }, [current]);

  const slots = normalizeSlots(dispatchSlots);
  const errors: string[] = [];
  if (!validMinutes(preparationMinutes)) {
    errors.push('Thời gian soạn hàng phải là số phút không âm.');
  }
  if (!validMinutes(bufferMinutes)) {
    errors.push('Thời gian đệm phải là số phút không âm.');
  }
  if (slots.length === 0 || slots.some((slot) => !validTime(slot))) {
    errors.push('Cần ít nhất một giờ xuất kho dạng HH:mm; nhiều mốc cách nhau bằng dấu phẩy.');
  }

  if (new Set(slots).size !== slots.length) errors.push('Các giờ xuất kho không được trùng nhau.');

  const submit = () => {
    if (errors.length || publish.isPending) return;
    publish.mutate({
      timeZone: current.timeZone,
      preparationMinutes: Number(preparationMinutes),
      bufferMinutes: Number(bufferMinutes),
      dispatchSlotsLocalTime: slots,
    });
  };

  return (
    <div className="stack">
      <Callout tone="info">
        Phân bổ và tính giá chạy <strong>theo thời gian thực khi đơn bán hàng được gửi</strong>. Thời gian nhận dự kiến không chờ đợt và
        không chờ quản trị viên duyệt; hệ thống chỉ cộng thời gian soạn, xử lý kho, chờ chuyến xuất tiếp theo,
        vận chuyển và thời gian đệm.
      </Callout>

      <ScheduleFields value={{ preparationMinutes, bufferMinutes, dispatchSlots }} onChange={value => {
        setPreparationMinutes(value.preparationMinutes); setBufferMinutes(value.bufferMinutes); setDispatchSlots(value.dispatchSlots);
      }} />

      {errors.length > 0 && (
        <Callout tone="danger">
          {errors.map((error) => <div key={error}>{error}</div>)}
        </Callout>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button variant="primary" disabled={errors.length > 0} loading={publish.isPending} onClick={submit}>
          Lưu cấu hình thời gian nhận dự kiến
        </Button>
      </div>
    </div>
  );
}


export interface ScheduleDraft { preparationMinutes: string; bufferMinutes: string; dispatchSlots: string }
export function ScheduleFields({ value, onChange }: { value: ScheduleDraft; onChange: (value: ScheduleDraft) => void }) {
  return (
      <div className="config-fields config-fields--three">
        <FormField label="Thời gian soạn hàng (phút)" hint="Tính từ lúc phân bổ theo thời gian thực hoàn tất.">
          <Input
            type="number"
            min={0}
            step={1}
            value={value.preparationMinutes}
            onChange={(event) => onChange({ ...value, preparationMinutes: event.target.value })}
          />
        </FormField>
        <FormField label="Thời gian đệm khi giao hàng (phút)" hint="Biên an toàn cộng sau thời gian vận chuyển.">
          <Input
            type="number"
            min={0}
            step={1}
            value={value.bufferMinutes}
            onChange={(event) => onChange({ ...value, bufferMinutes: event.target.value })}
          />
        </FormField>
        <FormField label="Các giờ xuất kho" hint="Ví dụ: 06:00, 14:00. Hệ thống chọn chuyến gần nhất sau khi soạn xong.">
          <Input value={value.dispatchSlots} onChange={(event) => onChange({ ...value, dispatchSlots: event.target.value })} />
        </FormField>
      </div>
  );
}
