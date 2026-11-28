import { BackgroundJobsSection } from '../components/BackgroundJobsSection';
import { useState } from 'react';
import { Button, Callout, Card, FormField, Input, PageHeader, QueryState, Tabs } from '@/shared/ui';
import { WeightsEditor } from '../components/WeightsEditor';
import { TransitTableSection } from '../components/TransitTableSection';
import { RunScheduleSection } from '../components/RunScheduleSection';
import { useBackgroundJobs, useRunSchedule, useSaveConfig, useSettings, useTransitTable } from '../hooks';
import type { SystemSettings } from '../types';
import { validAllocationWeights, validKilometers } from '../validation';

type SettingsGroup = 'allocation' | 'delivery' | 'payment';
const settingsKeys: Record<SettingsGroup, readonly string[]> = {
  allocation: ['allocation.weights', 'demo.fast_scan_enabled'],
  delivery: ['allocation.service_radius_meters', 'order.order_step_cartons', 'mlor.default_ratio', 'order.completion_grace_days'],
  payment: ['payment.payos_link_lifetime_minutes'],
};
const saveLabels: Record<SettingsGroup, string> = {
  allocation: 'Lưu cấu hình phân bổ',
  delivery: 'Lưu điều kiện đặt hàng và giao hàng',
  payment: 'Lưu thời hạn link PayOS',
};

export function SettingsForm({ settings, group }: { settings: SystemSettings; group: SettingsGroup }) {
  const [weights, setWeights] = useState({ wE: String(settings.allocation.wE), wD: String(settings.allocation.wD), wQ: String(settings.allocation.wQ) });
  const [radius, setRadius] = useState(String(settings.dmaxRetailerKm));
  const [step, setStep] = useState(String(settings.orderStepCartons));
  const [mlor, setMlor] = useState(String(settings.defaultMlorRatio * 100));
  const [graceDays, setGraceDays] = useState(String(settings.orderCompletionGraceDays));
  const [linkMinutes, setLinkMinutes] = useState(String(settings.payOsLinkLifetimeMinutes));
  const [demoFastScan, setDemoFastScan] = useState(settings.demoFastScanEnabled);
  const save = useSaveConfig();
  const valid = group === 'allocation' ? validAllocationWeights(Object.values(weights))
    : group === 'payment' ? linkMinutes.trim() !== '' && Number.isInteger(Number(linkMinutes)) && Number(linkMinutes) >= 0 && Number(linkMinutes) <= 10080
    : validKilometers(Number(radius)) && Number(radius) > 0 && Number(radius) * 1000 <= 2147483647
      && Number.isInteger(Number(step)) && Number(step) > 0 && Number(step) <= 2147483647
      && Number(mlor) > 0 && Number(mlor) < 100
      && graceDays.trim() !== '' && Number.isInteger(Number(graceDays)) && Number(graceDays) >= 0 && Number(graceDays) <= 365;
  return <>
    {group === 'allocation' && <>
      <Card title="Trọng số phân bổ đơn hàng">
        <WeightsEditor value={weights} onChange={setWeights} />
      </Card>
      <Card title="Quét nhanh trên ứng dụng di động">
        <label className="check" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={demoFastScan} onChange={e => setDemoFastScan(e.target.checked)} />
          Hiện nút "Quét nhanh" (demo) trên ứng dụng di động
        </label>
        {demoFastScan && <Callout tone="danger">Khi bật, ứng dụng nhận sẵn danh sách mã thùng của phiếu nhập, phiếu xuất kho và lô hàng đang giao, nên việc quét không còn chứng minh hàng thực tế. Chỉ bật khi demo và tắt ngay sau đó.</Callout>}
      </Card>
    </>}
    {group === 'delivery' && <Card title="Điều kiện đặt hàng và giao hàng">
      <div className="form-grid cols-2">
        <FormField label="Bán kính phục vụ (km)"><Input value={radius} onChange={e => setRadius(e.target.value)} inputMode="decimal" /></FormField>
        <FormField label="Bước số lượng (thùng)"><Input value={step} onChange={e => setStep(e.target.value)} inputMode="numeric" /></FormField>
        <FormField label="Yêu cầu HSD tối thiểu mặc định (%)"><Input value={mlor} onChange={e => setMlor(e.target.value)} inputMode="decimal" /></FormField>
        <FormField label="Hạn gửi khiếu nại / chờ hoàn tất đơn (ngày)"><Input value={graceDays} onChange={e => setGraceDays(e.target.value)} inputMode="numeric" /></FormField>
      </div>
      <Callout tone={Number(graceDays) === 0 ? 'danger' : 'info'}>
        Số ngày này vừa là hạn nhà bán lẻ gửi khiếu nại (tính từ lúc xác nhận nhận hàng), vừa là thời gian chờ trước khi hoàn tất đơn và cộng điểm.
        {Number(graceDays) === 0 && ' 0 ngày = nhà bán lẻ không thể gửi yêu cầu.'}
      </Callout>
    </Card>}
    {group === 'payment' && <Card title="Thời hạn link thanh toán PayOS">
      <div className="form-grid cols-2">
        <FormField label="Thời hạn link thanh toán PayOS (phút)"><Input value={linkMinutes} onChange={e => setLinkMinutes(e.target.value)} inputMode="numeric" /></FormField>
      </div>
      <Callout tone="info">
        Áp dụng cho link mới của đơn trả trước và thanh toán công nợ. Hết hạn mà chưa trả, nhà bán lẻ có thể tạo lại link.
        {Number(linkMinutes) === 0 && ' 0 phút = không đặt hạn, link mở đến khi nhà bán lẻ hủy.'}
      </Callout>
    </Card>}
    {!valid && <Callout tone="danger">{group === 'allocation'
      ? 'Trọng số phải không âm và có tổng bằng 1.'
      : group === 'payment' ? 'Thời hạn link PayOS phải là số nguyên từ 0 đến 10080 phút.'
      : 'Bán kính và bước thùng phải dương; yêu cầu HSD tối thiểu nằm giữa 0 và 100%; số ngày chờ hoàn tất từ 0 đến 365.'}</Callout>}
      <Button variant="primary" style={{ marginTop: 16 }} disabled={!valid} loading={save.isPending} onClick={() => { if (!valid || save.isPending) return; save.mutate({ keys: settingsKeys[group], settings: {
        allocation: { wE: Number(weights.wE), wD: Number(weights.wD), wQ: Number(weights.wQ) },
        dmaxRetailerKm: Number(radius), orderStepCartons: Number(step), defaultMlorRatio: Number(mlor) / 100,
        orderCompletionGraceDays: Number(graceDays), payOsLinkLifetimeMinutes: Number(linkMinutes),
        demoFastScanEnabled: demoFastScan,
      } }); }}>{saveLabels[group]}</Button>
  </>;
}

export function ConfigPage() {
  const settings = useSettings(), transit = useTransitTable(), schedule = useRunSchedule(), jobs = useBackgroundJobs();
  const [tab, setTab] = useState<'allocation' | 'delivery' | 'batches' | 'payment'>('allocation');
  return <>
    <PageHeader title="Cấu hình hệ thống" subtitle="Quản lý cấu hình theo từng nhóm chức năng." />
    <Tabs items={[
      { key: 'allocation', label: 'Phân bổ đơn hàng' },
      { key: 'delivery', label: 'Vận chuyển & Giao hàng' },
      { key: 'batches', label: 'Quản lý lô hàng' },
      { key: 'payment', label: 'Báo giá & Thanh toán' },
    ]} value={tab} onChange={setTab} />
    <div role="tabpanel" aria-label="Phân bổ đơn hàng" hidden={tab !== 'allocation'}>
      <QueryState query={settings}>{s => <SettingsForm key={JSON.stringify([s.allocation, s.demoFastScanEnabled])} settings={s} group="allocation" />}</QueryState>
    </div>
    <div role="tabpanel" aria-label="Vận chuyển & Giao hàng" hidden={tab !== 'delivery'}>
      <Card title="Bảng vận chuyển dùng chung">
        <QueryState query={transit}>{t => <TransitTableSection current={t} />}</QueryState>
      </Card>
      <QueryState query={settings}>{s => <SettingsForm key={JSON.stringify([s.dmaxRetailerKm, s.orderStepCartons, s.defaultMlorRatio, s.orderCompletionGraceDays])} settings={s} group="delivery" />}</QueryState>
      <Card title="Thời gian nhận dự kiến sau phân bổ">
        <QueryState query={schedule}>{s => <RunScheduleSection current={s} />}</QueryState>
      </Card>
    </div>
    <div role="tabpanel" aria-label="Quản lý lô hàng" hidden={tab !== 'batches'}>
      <QueryState query={jobs}>{s => <BackgroundJobsSection key={JSON.stringify([s.dateTracker, s.inventoryOutbox, s.allocationRecovery])} current={s} group="batches" />}</QueryState>
    </div>
    <div role="tabpanel" aria-label="Báo giá & Thanh toán" hidden={tab !== 'payment'}>
      <QueryState query={jobs}>{s => <BackgroundJobsSection key={JSON.stringify(s.orderDeadline)} current={s} group="payment" />}</QueryState>
      <QueryState query={settings}>{s => <SettingsForm key={s.payOsLinkLifetimeMinutes} settings={s} group="payment" />}</QueryState>
    </div>
  </>;
}
