import { useState } from 'react';
import { Button, Callout, Card, PageHeader, QueryState, Tabs, ToggleSwitch } from '@/shared/ui';
import { BackgroundJobsSection } from '../components/BackgroundJobsSection';
import { WeightsEditor } from '../components/WeightsEditor';
import { TransitTableSection } from '../components/TransitTableSection';
import { DeliverySettingsForm } from '../components/DeliverySettingsForm';
import { PaymentSettingsForm } from '../components/PaymentSettingsForm';
import { useBackgroundJobs, useRunSchedule, useSaveConfig, useSettings, useTransitTable } from '../hooks';
import type { SystemSettings } from '../types';
import { validAllocationWeights } from '../validation';
import '../config.css';

export function SettingsForm({ settings }: { settings: SystemSettings }) {
  const [weights, setWeights] = useState({ wE: String(settings.allocation.wE), wD: String(settings.allocation.wD), wQ: String(settings.allocation.wQ) });
  const [demoFastScan, setDemoFastScan] = useState(settings.demoFastScanEnabled);
  const save = useSaveConfig();
  const valid = validAllocationWeights(Object.values(weights));
  return <div className="config-sections">
    <Card title="Trọng số phân bổ đơn hàng">
      <WeightsEditor value={weights} onChange={setWeights} />
    </Card>
    <Card title="Quét nhanh trên ứng dụng di động">
      <div className="config-section-body">
        <ToggleSwitch label='Hiện nút "Quét nhanh" (demo) trên ứng dụng di động' checked={demoFastScan} onChange={setDemoFastScan} />
        {demoFastScan && <Callout tone="danger">Khi bật, ứng dụng nhận sẵn danh sách mã thùng của phiếu nhập, phiếu xuất kho và lô hàng đang giao, nên việc quét không còn chứng minh hàng thực tế. Chỉ bật khi demo và tắt ngay sau đó.</Callout>}
      </div>
    </Card>
    {!valid && <Callout tone="danger">Trọng số phải không âm và có tổng bằng 1.</Callout>}
    <div className="config-actions">
      <Button variant="primary" disabled={!valid} loading={save.isPending} onClick={() => {
        if (!valid || save.isPending) return;
        save.mutate({ keys: ['allocation.weights', 'demo.fast_scan_enabled'], settings: {
          ...settings, allocation: { wE: Number(weights.wE), wD: Number(weights.wD), wQ: Number(weights.wQ) },
          demoFastScanEnabled: demoFastScan,
        } });
      }}>Lưu cấu hình phân bổ</Button>
    </div>
  </div>;
}

export function ConfigPage() {
  const settings = useSettings(), transit = useTransitTable(), schedule = useRunSchedule(), jobs = useBackgroundJobs();
  const [tab, setTab] = useState<'allocation' | 'delivery' | 'batches' | 'payment'>('allocation');
  const [deliveryTab, setDeliveryTab] = useState<'conditions' | 'transit'>('conditions');
  return <div className="config-page">
    <PageHeader title="Cấu hình hệ thống" subtitle="Quản lý cấu hình theo từng nhóm chức năng." />
    <Tabs items={[
      { key: 'allocation', label: 'Phân bổ đơn hàng' },
      { key: 'delivery', label: 'Vận chuyển & Giao hàng' },
      { key: 'batches', label: 'Quản lý lô hàng' },
      { key: 'payment', label: 'Báo giá & Thanh toán' },
    ]} value={tab} onChange={setTab} />
    <div role="tabpanel" aria-label="Phân bổ đơn hàng" hidden={tab !== 'allocation'} className="config-panel">
      <QueryState query={settings}>{s => <SettingsForm key={JSON.stringify([s.allocation, s.demoFastScanEnabled])} settings={s} />}</QueryState>
    </div>
    <div role="tabpanel" aria-label="Vận chuyển & Giao hàng" hidden={tab !== 'delivery'} className="config-panel">
      <div className="config-subtabs">
        <Tabs variant="pills" items={[
          { key: 'conditions', label: 'Điều kiện & Thời gian giao hàng' },
          { key: 'transit', label: 'Bảng vận chuyển' },
        ]} value={deliveryTab} onChange={setDeliveryTab} />
      </div>
      <div role="tabpanel" aria-label="Điều kiện & Thời gian giao hàng" hidden={deliveryTab !== 'conditions'} className="config-subpanel">
        <QueryState query={settings}>{s => <QueryState query={schedule}>{timing =>
          <DeliverySettingsForm settings={s} schedule={timing} key={JSON.stringify([
            s.dmaxRetailerKm, s.orderStepCartons, s.defaultMlorRatio, s.orderCompletionGraceDays,
            timing.timeZone, timing.preparationMinutes, timing.bufferMinutes, timing.dispatchSlotsLocalTime,
          ])} />
        }</QueryState>}</QueryState>
      </div>
      <div role="tabpanel" aria-label="Bảng vận chuyển" hidden={deliveryTab !== 'transit'} className="config-subpanel">
        <Card title="Bảng vận chuyển dùng chung">
          <QueryState query={transit}>{t => <TransitTableSection current={t} />}</QueryState>
        </Card>
      </div>
    </div>
    <div role="tabpanel" aria-label="Quản lý lô hàng" hidden={tab !== 'batches'} className="config-panel">
      <QueryState query={jobs}>{s => <BackgroundJobsSection key={JSON.stringify([s.dateTracker, s.inventoryOutbox, s.allocationRecovery])} current={s} />}</QueryState>
    </div>
    <div role="tabpanel" aria-label="Báo giá & Thanh toán" hidden={tab !== 'payment'} className="config-panel">
      <QueryState query={jobs}>{s => <QueryState query={settings}>{business =>
        <PaymentSettingsForm deadline={s.orderDeadline} linkLifetime={business.payOsLinkLifetimeMinutes}
          key={JSON.stringify([s.orderDeadline, business.payOsLinkLifetimeMinutes])} />
      }</QueryState>}</QueryState>
    </div>
  </div>;
}
