import { Chip, Input, SimpleTable } from '@/shared/ui';
import { formatDate } from '@/shared/lib';
import type { TransitBand } from '../types';

export interface BandDraft { days: string; cost: string }

/** The shared transit rule table (km band → days, cost). Used for retailer deliveries and warehouse transfers (last band: warehouses only). */
export function TransitTableEditor({ bands, draft, onChange, validFrom }: { bands: TransitBand[]; draft: BandDraft[]; onChange: (d: BandDraft[]) => void; validFrom: string }) {
  const set = (i: number, patch: Partial<BandDraft>) => onChange(draft.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <div className="stack-sm">
      <SimpleTable
        rows={bands}
        columns={[
          { header: 'Khoảng cách', cell: (b) => (b.fromKm === 0 ? `0 – ${b.toKm} km` : `> ${b.fromKm} – ${b.toKm} km`) },
          { header: 'Áp dụng cho', cell: (b) => <Chip tone={b.scope === 'WarehouseOnly' ? 'warn' : 'ok'}>{b.scope === 'WarehouseOnly' ? 'Chỉ giữa các kho' : 'Giao retailer + điều chuyển kho'}</Chip> },
          { header: 'Số ngày', width: '120px', cell: (_, i) => <Input className="inp-sm" inputMode="numeric" invalid={!(Number(draft[i].days) > 0)} value={draft[i].days} onChange={(e) => set(i, { days: e.target.value })} /> },
          { header: 'Chi phí (đ / chuyến)', width: '180px', cell: (_, i) => <Input className="inp-sm" inputMode="numeric" invalid={!(Number(draft[i].cost) >= 0)} value={draft[i].cost} onChange={(e) => set(i, { cost: e.target.value })} /> },
        ]}
      />
      <span className="muted small">Hiệu lực từ {formatDate(validFrom)}. Chi phí chỉ để hiển thị và so sánh, không phải trọng số phân bổ.</span>
    </div>
  );
}
