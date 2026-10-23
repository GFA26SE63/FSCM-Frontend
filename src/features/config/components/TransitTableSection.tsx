import { useMemo, useState } from 'react';
import { Button, Callout, Chip, Input, SimpleTable } from '@/shared/ui';
import { formatInstantDate, formatMoney } from '@/shared/lib';
import { usePublishTransitTable, useTransitHistory } from '../hooks';
import type { TransitBand, TransitTable } from '../types';

/** One editable row. Kept as strings so a half-typed number does not blank the field. */
interface BandDraft {
  minKm: string;
  maxKm: string;
  handlingMinutes: string;
  transitMinutes: string;
  cost: string;
}

const toDraft = (bands: TransitBand[]): BandDraft[] =>
  bands.map((b) => ({
    minKm: String(b.minDistanceMeters / 1000),
    maxKm: String(b.maxDistanceMeters / 1000),
    handlingMinutes: String(b.handlingMinutes),
    transitMinutes: String(b.transitMinutes),
    cost: String(b.estimatedCostAmount),
  }));

const num = (v: string) => (v.trim() === '' ? Number.NaN : Number(v));

/**
 * Mirrors the backend rules so the editor explains the problem before a failed save:
 * bands start at 0, meet end to end with the upper bound exclusive, and cover the serving distance.
 */
function validate(draft: BandDraft[], servingKm: string, effectiveFrom: string, currentFrom: string): string[] {
  const errors: string[] = [];
  const serving = num(servingKm);
  if (!(serving > 0)) errors.push('Bán kính phục vụ phải lớn hơn 0.');
  if (!effectiveFrom) errors.push('Chưa chọn ngày hiệu lực.');
  else if (effectiveFrom <= currentFrom.slice(0, 10)) {
    errors.push(`Ngày hiệu lực phải sau phiên bản hiện tại (${formatInstantDate(currentFrom)}).`);
  }
  if (draft.length === 0) errors.push('Cần ít nhất một khoảng km.');

  draft.forEach((b, i) => {
    const min = num(b.minKm);
    const max = num(b.maxKm);
    const row = `Dòng ${i + 1}`;
    if (Number.isNaN(min) || Number.isNaN(max)) errors.push(`${row}: thiếu khoảng km.`);
    else if (max <= min) errors.push(`${row}: km kết thúc phải lớn hơn km bắt đầu.`);
    if (!(num(b.handlingMinutes) >= 0)) errors.push(`${row}: thời gian soạn không hợp lệ.`);
    if (!(num(b.transitMinutes) >= 0)) errors.push(`${row}: thời gian vận chuyển không hợp lệ.`);
    if (!(num(b.cost) >= 0)) errors.push(`${row}: chi phí không hợp lệ.`);
  });

  const ordered = [...draft].sort((a, b) => num(a.minKm) - num(b.minKm));
  if (ordered.length > 0 && num(ordered[0].minKm) !== 0) errors.push('Khoảng đầu tiên phải bắt đầu từ 0 km.');
  ordered.forEach((b, i) => {
    if (i === 0) return;
    const previousMax = num(ordered[i - 1].maxKm);
    const min = num(b.minKm);
    if (Number.isNaN(previousMax) || Number.isNaN(min)) return;
    if (min > previousMax) errors.push(`Hở giữa ${previousMax} km và ${min} km — các khoảng phải nối liền nhau.`);
    if (min < previousMax) errors.push(`Chồng nhau giữa ${min} km và ${previousMax} km.`);
  });
  const last = ordered.length > 0 ? ordered[ordered.length - 1] : undefined;
  if (last && !Number.isNaN(num(last.maxKm)) && serving > 0 && num(last.maxKm) < serving) {
    errors.push(`Các khoảng mới phủ tới ${last.maxKm} km, chưa đủ bán kính phục vụ ${serving} km.`);
  }
  return errors;
}

export function TransitTableSection({ current }: { current: TransitTable }) {
  const [draft, setDraft] = useState<BandDraft[]>(() => toDraft(current.bands));
  const [servingKm, setServingKm] = useState(String(current.maxServingDistanceMeters / 1000));
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [note, setNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const publish = usePublishTransitTable();
  const history = useTransitHistory();

  const errors = useMemo(
    () => validate(draft, servingKm, effectiveFrom, current.effectiveFrom),
    [draft, servingKm, effectiveFrom, current.effectiveFrom],
  );

  const set = (i: number, patch: Partial<BandDraft>) =>
    setDraft(draft.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const addBand = () => {
    const lastMax = draft.length > 0 ? draft[draft.length - 1].maxKm : '0';
    setDraft([...draft, { minKm: lastMax, maxKm: '', handlingMinutes: '60', transitMinutes: '1440', cost: '0' }]);
  };

  const onPublish = async () => {
    await publish.mutateAsync({
      maxServingDistanceMeters: Math.round(num(servingKm) * 1000),
      effectiveFrom: new Date(`${effectiveFrom}T00:00:00+07:00`).toISOString(),
      note: note.trim() === '' ? null : note.trim(),
      bands: [...draft]
        .sort((a, b) => num(a.minKm) - num(b.minKm))
        .map((b) => ({
          minDistanceMeters: Math.round(num(b.minKm) * 1000),
          maxDistanceMeters: Math.round(num(b.maxKm) * 1000),
          handlingMinutes: Math.round(num(b.handlingMinutes)),
          transitMinutes: Math.round(num(b.transitMinutes)),
          estimatedCostAmount: num(b.cost),
        })),
    });
    setEffectiveFrom('');
    setNote('');
  };

  return (
    <div className="stack-sm">
      <div className="row gap-sm items-center">
        <Chip tone="ok">Phiên bản {current.version}</Chip>
        <span className="muted small">Hiệu lực từ {formatInstantDate(current.effectiveFrom)}</span>
        <Button size="sm" variant="ghost" onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? 'Ẩn lịch sử' : 'Xem lịch sử'}
        </Button>
      </div>

      {showHistory && (
        <SimpleTable
          rows={history.data ?? []}
          columns={[
            { header: 'Phiên bản', cell: (t) => `v${t.version}` },
            { header: 'Hiệu lực từ', cell: (t) => formatInstantDate(t.effectiveFrom) },
            { header: 'Đến', cell: (t) => (t.effectiveTo ? formatInstantDate(t.effectiveTo) : 'đang áp dụng') },
            { header: 'Số khoảng', cell: (t) => t.bands.length },
            { header: 'Ghi chú', cell: (t) => t.note ?? '—' },
          ]}
        />
      )}

      <SimpleTable
        rows={draft}
        columns={[
          {
            header: 'Từ (km)', width: '110px',
            cell: (_, i) => <Input className="inp-sm" inputMode="decimal" value={draft[i].minKm} onChange={(e) => set(i, { minKm: e.target.value })} />,
          },
          {
            header: 'Đến (km)', width: '110px',
            cell: (_, i) => <Input className="inp-sm" inputMode="decimal" value={draft[i].maxKm} onChange={(e) => set(i, { maxKm: e.target.value })} />,
          },
          {
            header: 'Soạn (phút)', width: '120px',
            cell: (_, i) => <Input className="inp-sm" inputMode="numeric" value={draft[i].handlingMinutes} onChange={(e) => set(i, { handlingMinutes: e.target.value })} />,
          },
          {
            header: 'Vận chuyển (phút)', width: '150px',
            cell: (_, i) => <Input className="inp-sm" inputMode="numeric" value={draft[i].transitMinutes} onChange={(e) => set(i, { transitMinutes: e.target.value })} />,
          },
          {
            header: 'Chi phí ước tính (đ)', width: '180px',
            cell: (_, i) => <Input className="inp-sm" inputMode="numeric" value={draft[i].cost} onChange={(e) => set(i, { cost: e.target.value })} />,
          },
          {
            header: '', width: '60px',
            cell: (_, i) => (
              <Button size="sm" variant="ghost" onClick={() => setDraft(draft.filter((__, j) => j !== i))}>Xoá</Button>
            ),
          },
        ]}
      />

      <div className="row gap-sm items-end">
        <Button size="sm" variant="ghost" onClick={addBand}>+ Thêm khoảng</Button>
        <label className="stack-xs small">
          Bán kính phục vụ (km)
          <Input className="inp-sm" inputMode="decimal" value={servingKm} onChange={(e) => setServingKm(e.target.value)} />
        </label>
        <label className="stack-xs small">
          Ngày hiệu lực
          <Input className="inp-sm" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </label>
        <label className="stack-xs small" style={{ flex: 1 }}>
          Ghi chú
          <Input className="inp-sm" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      {errors.length > 0 && (
        <Callout tone="warn">
          <ul className="stack-xs">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </Callout>
      )}

      <div className="row gap-sm items-center">
        <Button variant="primary" disabled={errors.length > 0 || publish.isPending} onClick={onPublish}>
          Phát hành phiên bản mới
        </Button>
        <span className="muted small">
          Phát hành không ghi đè: phiên bản {current.version} được đóng lại và giữ nguyên để giải thích các đợt đã chạy.
          Chi phí chỉ để tham khảo, không tham gia chấm điểm chọn batch.
        </span>
      </div>

      {current.bands.length > 0 && (
        <span className="muted small">
          Đang áp dụng: {current.bands.map((b) => `${b.minDistanceMeters / 1000}–${b.maxDistanceMeters / 1000} km · ${b.transitMinutes} phút · ${formatMoney(b.estimatedCostAmount)}`).join('  |  ')}
        </span>
      )}
    </div>
  );
}
