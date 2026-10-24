import { useEffect, useState } from 'react';
import { Button, Callout, Card, FormField, Input, PageHeader, QueryState } from '@/shared/ui';
import { WeightsEditor } from '../components/WeightsEditor';
import { TransitTableSection } from '../components/TransitTableSection';
import { RunScheduleSection } from '../components/RunScheduleSection';
import { useRunSchedule, useSaveConfig, useSettings, useTransitTable } from '../hooks';
import type { RunSchedule, SystemSettings, TransitTable } from '../types';

type W = { wE: string; wD: string; wQ: string };
interface Draft {
  alloc: W; rot: W; dRetailer: string; dWh: string; velocityDays: string; minQty: string; roundTo: string; minRegional: string; loyalty: string;
  tiers: { maxRemainingPct: string; discountPct: string }[];
}
const w = (x: { wE: number; wD: number; wQ: number }): W => ({ wE: String(x.wE), wD: String(x.wD), wQ: String(x.wQ) });
const toDraft = (s: SystemSettings): Draft => ({
  alloc: w(s.allocation), rot: w(s.rotation), dRetailer: String(s.dmaxRetailerKm), dWh: String(s.dmaxWarehouseKm), velocityDays: String(s.rotation.velocityDays),
  minQty: String(s.rotation.minQty), roundTo: String(s.rotation.roundTo), minRegional: String(s.minRegionalStock), loyalty: String(s.loyaltyPointRateVnd),
  tiers: s.batchDiscountTiers.map((x) => ({ maxRemainingPct: String(x.maxRemainingPct), discountPct: String(x.discountPct) })),
});
const sum = (x: W) => Number(x.wE) + Number(x.wD) + Number(x.wQ);

function ConfigForm({ settings, transit, schedule }: { settings: SystemSettings; transit: TransitTable; schedule: RunSchedule }) {
  const [d, setD] = useState<Draft>(() => toDraft(settings));
  const save = useSaveConfig();
  useEffect(() => setD(toDraft(settings)), [settings]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }));
  const num = (v: string) => v.trim() !== '' && !Number.isNaN(Number(v));

  const errors: string[] = [];
  if (Math.abs(sum(d.alloc) - 1) > 0.001) errors.push('Tổng trọng số phân bổ phải bằng 1.');
  if (Math.abs(sum(d.rot) - 1) > 0.001) errors.push('Tổng trọng số luân chuyển phải bằng 1.');
  if (!num(d.dRetailer) || !num(d.dWh)) errors.push('Dmax phải là số.');
  else if (Number(d.dRetailer) > Number(d.dWh)) errors.push('Dmax_retailer không được lớn hơn Dmax_kho.');
  if (![d.velocityDays, d.minQty, d.roundTo, d.minRegional, d.loyalty].every(num)) errors.push('Các tham số luân chuyển / loyalty phải là số.');

  const submit = () =>
    save.mutate({
      settings: {
        allocation: { wE: Number(d.alloc.wE), wD: Number(d.alloc.wD), wQ: Number(d.alloc.wQ) },
        dmaxRetailerKm: Number(d.dRetailer), dmaxWarehouseKm: Number(d.dWh),
        rotation: { wE: Number(d.rot.wE), wD: Number(d.rot.wD), wQ: Number(d.rot.wQ), velocityDays: Number(d.velocityDays), minQty: Number(d.minQty), roundTo: Number(d.roundTo) },
        minRegionalStock: Number(d.minRegional), loyaltyPointRateVnd: Number(d.loyalty),
        batchDiscountTiers: d.tiers.map((t) => ({ maxRemainingPct: Number(t.maxRemainingPct), discountPct: Number(t.discountPct) })),
      },
    });

  return (
    <>
      <PageHeader title="Cấu hình hệ thống" subtitle="Trọng số phân bổ / luân chuyển, phạm vi phục vụ, bảng vận chuyển dùng chung và quy đổi điểm loyalty." actions={<Button variant="primary" disabled={errors.length > 0} loading={save.isPending} onClick={submit}>Lưu cấu hình</Button>} />
      {errors.length > 0 && <Callout tone="danger">{errors.map((e) => <div key={e}>{e}</div>)}</Callout>}

      <Card title="Lịch ngày chạy đợt: giờ chốt và các mốc nhắc duyệt">
        <RunScheduleSection current={schedule} />
      </Card>

      <Card title="Trọng số phân bổ đơn hàng (B3): điểm = wE·fE + wD·fD + wQ·fQ">
        <WeightsEditor value={d.alloc} onChange={(v) => set('alloc', v)} />
      </Card>

      <Card title="Phạm vi phục vụ (Dmax)">
        <div className="form-grid cols-2">
          <FormField label="Dmax_retailer – kho phục vụ retailer (km)" hint="Mặc định 20. Kho xa hơn bị loại ở B2a."><Input inputMode="numeric" value={d.dRetailer} onChange={(e) => set('dRetailer', e.target.value)} /></FormField>
          <FormField label="Dmax_kho – điều chuyển giữa các kho (km)" hint="Mặc định 40. Kho đích xa hơn bị loại khi luân chuyển cận hạn."><Input inputMode="numeric" value={d.dWh} onChange={(e) => set('dWh', e.target.value)} /></FormField>
        </div>
      </Card>

      <Card title="Trọng số luân chuyển cận hạn: S = wE·fE + wD·fD + wQ·fQ">
        <div className="stack">
          <WeightsEditor value={d.rot} onChange={(v) => set('rot', v)} />
          <div className="form-grid">
            <FormField label="Số ngày tính tốc độ bán (v)"><Input inputMode="numeric" value={d.velocityDays} onChange={(e) => set('velocityDays', e.target.value)} /></FormField>
            <FormField label="Số lượng tối thiểu mỗi lượt (thùng)"><Input inputMode="numeric" value={d.minQty} onChange={(e) => set('minQty', e.target.value)} /></FormField>
            <FormField label="Làm tròn xuống bội số của (thùng)"><Input inputMode="numeric" value={d.roundTo} onChange={(e) => set('roundTo', e.target.value)} /></FormField>
            <FormField label="Tồn tối thiểu kho vùng (thùng)"><Input inputMode="numeric" value={d.minRegional} onChange={(e) => set('minRegional', e.target.value)} /></FormField>
          </div>
        </div>
      </Card>

      <Card title="Bảng vận chuyển dùng chung (khoảng km → thời gian, chi phí)">
        <TransitTableSection current={transit} />
      </Card>

      <Card title="Bậc giảm giá theo HSD còn lại">
        <div className="stack-sm">
          {d.tiers.map((t, i) => (
            <div key={i} className="form-grid cols-2">
              <FormField label={`Bậc ${i + 1}: HSD còn lại ≤ (%)`}><Input inputMode="numeric" value={t.maxRemainingPct} onChange={(e) => set('tiers', d.tiers.map((x, j) => (j === i ? { ...x, maxRemainingPct: e.target.value } : x)))} /></FormField>
              <FormField label="Gợi ý giảm (%)"><Input inputMode="numeric" value={t.discountPct} onChange={(e) => set('tiers', d.tiers.map((x, j) => (j === i ? { ...x, discountPct: e.target.value } : x)))} /></FormField>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Loyalty">
        <div className="form-grid cols-2">
          <FormField label="Số đồng quy đổi 1 điểm (đ)" hint="Điểm = thành tiền sau khuyến mãi ÷ giá trị này (làm tròn xuống)."><Input inputMode="numeric" value={d.loyalty} onChange={(e) => set('loyalty', e.target.value)} /></FormField>
        </div>
      </Card>
    </>
  );
}

export function ConfigPage() {
  const settings = useSettings();
  const transit = useTransitTable();
  const schedule = useRunSchedule();
  return (
    <QueryState query={settings}>
      {(s) => (
        <QueryState query={transit}>
          {(t) => (
            <QueryState query={schedule}>
              {(sch) => <ConfigForm settings={s} transit={t} schedule={sch} />}
            </QueryState>
          )}
        </QueryState>
      )}
    </QueryState>
  );
}
