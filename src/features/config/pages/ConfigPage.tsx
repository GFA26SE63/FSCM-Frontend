import { useState } from 'react';
import { Button, Callout, Card, FormField, Input, PageHeader, QueryState } from '@/shared/ui';
import { WeightsEditor } from '../components/WeightsEditor';
import { TransitTableSection } from '../components/TransitTableSection';
import { RunScheduleSection } from '../components/RunScheduleSection';
import { useRunSchedule, useSaveConfig, useSettings, useTransitTable } from '../hooks';
import type { SystemSettings } from '../types';

export function SettingsForm({ settings }: { settings: SystemSettings }) {
  const [weights, setWeights] = useState({ wE: String(settings.allocation.wE), wD: String(settings.allocation.wD), wQ: String(settings.allocation.wQ) });
  const [radius, setRadius] = useState(String(settings.dmaxRetailerKm));
  const [step, setStep] = useState(String(settings.orderStepCartons));
  const [mlor, setMlor] = useState(String(settings.defaultMlorRatio * 100));
  const save = useSaveConfig();
  const values = Object.values(weights).map(Number);
  const valid = Object.values(weights).every(v => v.trim() !== '') && values.every(v => Number.isFinite(v) && v >= 0)
    && Math.abs(values.reduce((s, v) => s + v, 0) - 1) <= 0.0001
    && Number.isFinite(Number(radius)) && Number(radius) > 0 && Number.isInteger(Number(radius) * 1000)
    && Number.isInteger(Number(step)) && Number(step) > 0 && Number(mlor) > 0 && Number(mlor) < 100;
  return <>
    <Card title="Trọng số phân bổ đơn hàng">
      <WeightsEditor value={weights} onChange={setWeights} />
    </Card>
    <Card title="Điều kiện đặt hàng và giao hàng">
      <div className="form-grid cols-2">
        <FormField label="Bán kính phục vụ (km)"><Input value={radius} onChange={e => setRadius(e.target.value)} inputMode="decimal" /></FormField>
        <FormField label="Bước số lượng (thùng)"><Input value={step} onChange={e => setStep(e.target.value)} inputMode="numeric" /></FormField>
        <FormField label="MLOR mặc định (%)"><Input value={mlor} onChange={e => setMlor(e.target.value)} inputMode="decimal" /></FormField>
      </div>
      {!valid && <Callout tone="danger">Trọng số phải không âm và có tổng bằng 1; bán kính và bước thùng phải dương; MLOR phải nằm giữa 0 và 100%.</Callout>}
      <Button variant="primary" disabled={!valid} loading={save.isPending} onClick={() => save.mutate({ settings: {
        allocation: { wE: Number(weights.wE), wD: Number(weights.wD), wQ: Number(weights.wQ) },
        dmaxRetailerKm: Number(radius), orderStepCartons: Number(step), defaultMlorRatio: Number(mlor) / 100,
      } })}>Lưu cấu hình</Button>
    </Card>
  </>;
}

export function ConfigPage() {
  const settings = useSettings(), transit = useTransitTable(), schedule = useRunSchedule();
  return <>
    <PageHeader title="Cấu hình hệ thống" subtitle="Điều kiện allocation real-time, bảng vận chuyển và lịch xuất kho." />
    <Card title="Bảng vận chuyển dùng chung">
      <QueryState query={transit}>{t => <TransitTableSection current={t} />}</QueryState>
    </Card>
    <Card title="Cấu hình ETA sau allocation real-time">
      <QueryState query={schedule}>{s => <RunScheduleSection current={s} />}</QueryState>
    </Card>
    <QueryState query={settings}>{s => <SettingsForm key={JSON.stringify(s)} settings={s} />}</QueryState>
  </>;
}
