import { useState } from 'react';
import { Button, Callout, Card, FormField, Input } from '@/shared/ui';
import { useSaveConfigurationEntries } from '../hooks';
import type { RunSchedule, SystemSettings } from '../types';
import { dispatchSlots, integerInRange, validDispatchSlots, validKilometers, validMinutes } from '../validation';
import { ScheduleFields, type ScheduleDraft } from './RunScheduleSection';

export function DeliverySettingsForm({ settings, schedule }: { settings: SystemSettings; schedule: RunSchedule }) {
  const [conditions, setConditions] = useState({
    radius: String(settings.dmaxRetailerKm), step: String(settings.orderStepCartons),
    mlor: String(settings.defaultMlorRatio * 100), graceDays: String(settings.orderCompletionGraceDays),
  });
  const [timing, setTiming] = useState<ScheduleDraft>({
    preparationMinutes: String(schedule.preparationMinutes), bufferMinutes: String(schedule.bufferMinutes),
    dispatchSlots: schedule.dispatchSlotsLocalTime.map(slot => slot.slice(0, 5)).join(', '),
  });
  const save = useSaveConfigurationEntries();
  const validConditions = conditions.radius.trim() !== '' && Number(conditions.radius) > 0
    && validKilometers(Number(conditions.radius)) && integerInRange(conditions.step, 1, 2147483647)
    && Number(conditions.mlor) > 0 && Number(conditions.mlor) < 100 && integerInRange(conditions.graceDays, 0, 365);
  const validTiming = validMinutes(timing.preparationMinutes) && validMinutes(timing.bufferMinutes) && validDispatchSlots(timing.dispatchSlots);
  const valid = validConditions && validTiming;
  const submit = () => {
    if (!valid || save.isPending) return;
    save.mutate([
      { key: 'allocation.service_radius_meters', value: Math.round(Number(conditions.radius) * 1000) },
      { key: 'order.order_step_cartons', value: Number(conditions.step) },
      { key: 'mlor.default_ratio', value: Number(conditions.mlor) / 100 },
      { key: 'order.completion_grace_days', value: Number(conditions.graceDays) },
      { key: 'eta.schedule', value: {
        timeZone: schedule.timeZone, preparationMinutes: Number(timing.preparationMinutes),
        bufferMinutes: Number(timing.bufferMinutes), dispatchSlotsLocalTime: dispatchSlots(timing.dispatchSlots),
      } },
    ]);
  };
  return <div className="config-sections">
    <Card title="Điều kiện đặt hàng và giao hàng">
      <div className="config-section-body">
        <div className="config-fields config-fields--four">
          <FormField label="Bán kính phục vụ (km)"><Input value={conditions.radius} onChange={e => setConditions({ ...conditions, radius: e.target.value })} inputMode="decimal" /></FormField>
          <FormField label="Bước số lượng (thùng)"><Input value={conditions.step} onChange={e => setConditions({ ...conditions, step: e.target.value })} inputMode="numeric" /></FormField>
          <FormField label="Yêu cầu HSD tối thiểu mặc định (%)"><Input value={conditions.mlor} onChange={e => setConditions({ ...conditions, mlor: e.target.value })} inputMode="decimal" /></FormField>
          <FormField label="Hạn khiếu nại / chờ hoàn tất (ngày)"><Input value={conditions.graceDays} onChange={e => setConditions({ ...conditions, graceDays: e.target.value })} inputMode="numeric" /></FormField>
        </div>
        <Callout tone={Number(conditions.graceDays) === 0 ? 'danger' : 'info'}>
          Số ngày chờ vừa là hạn nhà bán lẻ gửi khiếu nại từ lúc xác nhận nhận hàng, vừa là thời gian trước khi hoàn tất đơn và cộng điểm.
          {Number(conditions.graceDays) === 0 && ' 0 ngày = nhà bán lẻ không thể gửi yêu cầu.'}
        </Callout>
        {!validConditions && <Callout tone="danger">Bán kính và bước thùng phải dương; HSD tối thiểu nằm giữa 0 và 100%; số ngày chờ từ 0 đến 365.</Callout>}
      </div>
    </Card>
    <Card title="Thời gian nhận dự kiến sau phân bổ">
      <div className="config-section-body">
        <ScheduleFields value={timing} onChange={setTiming} />
        <Callout tone="info">ETA gồm thời gian soạn, xử lý kho, chờ chuyến xuất, vận chuyển và thời gian đệm. Phân bổ và tính giá vẫn chạy theo thời gian thực.</Callout>
        {!validTiming && <Callout tone="danger">Thời gian soạn và đệm phải là số phút nguyên không âm; cần ít nhất một giờ xuất kho HH:mm, không trùng nhau.</Callout>}
      </div>
    </Card>
    <div className="config-actions">
      <Button variant="primary" disabled={!valid} loading={save.isPending} onClick={submit}>Lưu điều kiện và thời gian giao hàng</Button>
    </div>
  </div>;
}
