import { useEffect, useState } from 'react';
import { Button, Callout, FormField, Input } from '@/shared/ui';
import { usePublishRunSchedule } from '../hooks';
import type { RunSchedule } from '../types';

const normalizeSlots = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** Operational ETA configuration for the real-time allocation flow. */
export function RunScheduleSection({ current }: { current: RunSchedule }) {
  const [preparationMinutes, setPreparationMinutes] = useState(current.preparationMinutes);
  const [bufferMinutes, setBufferMinutes] = useState(current.bufferMinutes);
  const [dispatchSlots, setDispatchSlots] = useState(current.dispatchSlotsLocalTime.map((v) => v.slice(0, 5)).join(', '));
  const publish = usePublishRunSchedule();

  useEffect(() => {
    setPreparationMinutes(current.preparationMinutes);
    setBufferMinutes(current.bufferMinutes);
    setDispatchSlots(current.dispatchSlotsLocalTime.map((v) => v.slice(0, 5)).join(', '));
  }, [current]);

  const slots = normalizeSlots(dispatchSlots);
  const errors: string[] = [];
  if (!Number.isInteger(preparationMinutes) || preparationMinutes < 0) {
    errors.push('Thời gian soạn hàng phải là số phút không âm.');
  }
  if (!Number.isInteger(bufferMinutes) || bufferMinutes < 0) {
    errors.push('Thời gian đệm phải là số phút không âm.');
  }
  if (slots.length === 0 || slots.some((slot) => !validTime(slot))) {
    errors.push('Cần ít nhất một giờ xuất kho dạng HH:mm; nhiều mốc cách nhau bằng dấu phẩy.');
  }

  const submit = () =>
    publish.mutate({
      timeZone: current.timeZone,
      preparationMinutes,
      bufferMinutes,
      dispatchSlotsLocalTime: slots,
    });

  return (
    <div className="stack">
      <Callout tone="info">
        Allocation và tính giá chạy <strong>real-time khi SO được gửi</strong>. ETA không chờ đợt và
        không chờ Admin duyệt; hệ thống chỉ cộng thời gian soạn, xử lý kho, chờ chuyến xuất tiếp theo,
        vận chuyển và thời gian đệm.
      </Callout>

      <div className="form-grid cols-2">
        <FormField label="Thời gian soạn hàng (phút)" hint="Tính từ lúc allocation real-time hoàn tất.">
          <Input
            type="number"
            min={0}
            step={1}
            value={preparationMinutes}
            onChange={(event) => setPreparationMinutes(Number(event.target.value))}
          />
        </FormField>
        <FormField label="Thời gian đệm ETA (phút)" hint="Biên an toàn cộng sau thời gian vận chuyển.">
          <Input
            type="number"
            min={0}
            step={1}
            value={bufferMinutes}
            onChange={(event) => setBufferMinutes(Number(event.target.value))}
          />
        </FormField>
        <FormField label="Các giờ xuất kho" hint="Ví dụ: 06:00, 14:00. Hệ thống chọn chuyến gần nhất sau khi soạn xong.">
          <Input value={dispatchSlots} onChange={(event) => setDispatchSlots(event.target.value)} />
        </FormField>
      </div>

      {errors.length > 0 && (
        <Callout tone="danger">
          {errors.map((error) => <div key={error}>{error}</div>)}
        </Callout>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button variant="primary" disabled={errors.length > 0} loading={publish.isPending} onClick={submit}>
          Lưu cấu hình ETA
        </Button>
        <span style={{ fontSize: 12.5, opacity: 0.75 }}>
          Bản {current.scheduleVersion} · múi giờ {current.timeZone}
        </span>
      </div>
    </div>
  );
}
