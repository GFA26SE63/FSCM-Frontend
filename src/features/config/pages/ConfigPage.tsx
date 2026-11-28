import { BackgroundJobsSection } from '../components/BackgroundJobsSection';
import { useState } from 'react';
import { Button, Callout, Card, FormField, Input, PageHeader, QueryState, Tabs } from '@/shared/ui';
import { WeightsEditor } from '../components/WeightsEditor';
import { TransitTableSection } from '../components/TransitTableSection';
import { RunScheduleSection } from '../components/RunScheduleSection';
import { useBackgroundJobs, useRunSchedule, useSaveConfig, useSettings, useTransitTable } from '../hooks';
import type { SystemSettings } from '../types';
import { validAllocationWeights, validKilometers } from '../validation';

export function SettingsForm({ settings }: { settings: SystemSettings }) {
  const [weights, setWeights] = useState({ wE: String(settings.allocation.wE), wD: String(settings.allocation.wD), wQ: String(settings.allocation.wQ) });
  const [radius, setRadius] = useState(String(settings.dmaxRetailerKm));
  const [step, setStep] = useState(String(settings.orderStepCartons));
  const [mlor, setMlor] = useState(String(settings.defaultMlorRatio * 100));
  const [graceDays, setGraceDays] = useState(String(settings.orderCompletionGraceDays));
  const [linkMinutes, setLinkMinutes] = useState(String(settings.payOsLinkLifetimeMinutes));
  const [demoFastScan, setDemoFastScan] = useState(settings.demoFastScanEnabled);
  const save = useSaveConfig();
  const valid = validAllocationWeights(Object.values(weights))
    && validKilometers(Number(radius)) && Number(radius) > 0
    && Number(radius) * 1000 <= 2147483647
    && Number.isInteger(Number(step)) && Number(step) > 0 && Number(step) <= 2147483647 && Number(mlor) > 0 && Number(mlor) < 100
    && Number.isInteger(Number(graceDays)) && Number(graceDays) >= 0 && Number(graceDays) <= 365
    && linkMinutes.trim() !== '' && Number.isInteger(Number(linkMinutes)) && Number(linkMinutes) >= 0 && Number(linkMinutes) <= 10080;
  return <>
    <Card title="Trọng số phân bổ đơn hàng">
      <WeightsEditor value={weights} onChange={setWeights} />
    </Card>
    <Card title="Điều kiện đặt hàng và giao hàng">
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
      <div className="form-grid cols-2" style={{ marginTop: 16 }}>
        <FormField label="Thời hạn link thanh toán PayOS (phút)"><Input value={linkMinutes} onChange={e => setLinkMinutes(e.target.value)} inputMode="numeric" /></FormField>
      </div>
      <Callout tone="info">
        Áp dụng cho link mới của đơn trả trước và thanh toán công nợ. Hết hạn mà chưa trả, nhà bán lẻ có thể tạo lại link.
        {Number(linkMinutes) === 0 && ' 0 phút = không đặt hạn, link mở đến khi nhà bán lẻ hủy.'}
      </Callout>
      <label className="check" style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={demoFastScan} onChange={e => setDemoFastScan(e.target.checked)} />
        Hiện nút "Quét nhanh" (demo) trên ứng dụng di động
      </label>
      {demoFastScan && <Callout tone="danger">Khi bật, ứng dụng nhận sẵn danh sách mã thùng của phiếu nhập, phiếu xuất kho và lô hàng đang giao, nên việc quét không còn chứng minh hàng thực tế. Chỉ bật khi demo và tắt ngay sau đó.</Callout>}
      {!valid && <Callout tone="danger">Trọng số phải không âm và có tổng bằng 1; bán kính và bước thùng phải dương; yêu cầu HSD tối thiểu phải nằm giữa 0 và 100%; số ngày chờ hoàn tất từ 0 đến 365; thời hạn link PayOS từ 0 đến 10080 phút.</Callout>}
      <Button variant="primary" style={{ marginTop: 16 }} disabled={!valid} loading={save.isPending} onClick={() => { if (!valid || save.isPending) return; save.mutate({ settings: {
        allocation: { wE: Number(weights.wE), wD: Number(weights.wD), wQ: Number(weights.wQ) },
        dmaxRetailerKm: Number(radius), orderStepCartons: Number(step), defaultMlorRatio: Number(mlor) / 100,
        orderCompletionGraceDays: Number(graceDays), payOsLinkLifetimeMinutes: Number(linkMinutes),
        demoFastScanEnabled: demoFastScan,
      } }); }}>Lưu cấu hình</Button>
    </Card>
  </>;
}

export function ConfigPage() {
  const settings = useSettings(), transit = useTransitTable(), schedule = useRunSchedule(), jobs = useBackgroundJobs();
  const [tab, setTab] = useState<'business' | 'transit' | 'schedule' | 'jobs'>('business');
  return <>
    <PageHeader title="Cấu hình hệ thống" subtitle="Quản lý cấu hình theo từng nhóm chức năng." />
    <Tabs items={[
      { key: 'business', label: 'Nghiệp vụ' },
      { key: 'transit', label: 'Vận chuyển' },
      { key: 'schedule', label: 'Lịch giao hàng' },
      { key: 'jobs', label: 'Tác vụ nền' },
    ]} value={tab} onChange={setTab} />
    <div role="tabpanel" aria-label="Tác vụ nền" hidden={tab !== 'jobs'}>
      <QueryState query={jobs}>{s => <BackgroundJobsSection key={JSON.stringify(s)} current={s} />}</QueryState>
    </div>
    <div role="tabpanel" aria-label="Nghiệp vụ" hidden={tab !== 'business'}>
      <QueryState query={settings}>{s => <SettingsForm key={JSON.stringify(s)} settings={s} />}</QueryState>
    </div>
    <div role="tabpanel" aria-label="Vận chuyển" hidden={tab !== 'transit'}>
      <Card title="Bảng vận chuyển dùng chung">
        <QueryState query={transit}>{t => <TransitTableSection current={t} />}</QueryState>
      </Card>
    </div>
    <div role="tabpanel" aria-label="Lịch giao hàng" hidden={tab !== 'schedule'}>
      <Card title="Thời gian nhận dự kiến sau phân bổ">
        <QueryState query={schedule}>{s => <RunScheduleSection current={s} />}</QueryState>
      </Card>
    </div>
  </>;
}
