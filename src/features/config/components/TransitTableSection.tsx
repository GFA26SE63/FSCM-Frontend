import { ExpandableRecord } from '@/shared/ui/ExpandableRecord';
import { useCurrentTime } from '@/shared/hooks';
import { useState } from 'react';
import { Button, Callout, Chip, FormField, Input, Modal, QueryState, SimpleTable } from '@/shared/ui';
import { formatInstantDate, formatMoney, minimumVersionDate } from '@/shared/lib';
import { validMinutes, validKilometers, validMoney } from '../validation';
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
export function validateTransitTable(draft: BandDraft[], servingKm: string, effectiveFrom: string, currentFrom: string): string[] {
  const errors: string[] = [];
  const serving = num(servingKm);
  if (!(serving > 0) || !validKilometers(serving)) errors.push('Bán kính phục vụ phải lớn hơn 0.');
  if (!effectiveFrom) errors.push('Chưa chọn ngày hiệu lực.');
  else if (effectiveFrom < minimumVersionDate(currentFrom)) {
    errors.push(`Ngày hiệu lực sớm nhất là ${formatInstantDate(`${minimumVersionDate(currentFrom)}T00:00:00+07:00`)} (giờ Việt Nam), sau phiên bản mới nhất.`);
  }
  if (draft.length === 0) errors.push('Cần ít nhất một khoảng km.');

  draft.forEach((b, i) => {
    const min = num(b.minKm);
    const max = num(b.maxKm);
    const row = `Dòng ${i + 1}`;
    if (!validKilometers(min) || !validKilometers(max)) errors.push(`${row}: thiếu khoảng km.`);
    else if (max <= min) errors.push(`${row}: km kết thúc phải lớn hơn km bắt đầu.`);
    if (!validMinutes(b.handlingMinutes)) errors.push(`${row}: thời gian soạn không hợp lệ.`);
    if (num(b.handlingMinutes) + num(b.transitMinutes) > 2147483647) errors.push(`${row}: tổng thời gian vượt giới hạn hỗ trợ.`);
    if (!validMinutes(b.transitMinutes)) errors.push(`${row}: thời gian vận chuyển không hợp lệ.`);
    if (!validMoney(num(b.cost))) errors.push(`${row}: chi phí không hợp lệ.`);
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
  const now = useCurrentTime();
  const [draft, setDraft] = useState<BandDraft[]>(() => toDraft(current.bands));
  const [servingKm, setServingKm] = useState(String(current.maxServingDistanceMeters / 1000));
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [note, setNote] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<BandDraft | null>(null);
  const publish = usePublishTransitTable();
  const history = useTransitHistory();

  const errors = validateTransitTable(draft, servingKm, effectiveFrom, current.effectiveFrom);
  const draftErrors = validateTransitTable(draft, servingKm, minimumVersionDate(current.effectiveFrom), current.effectiveFrom);
  if (note.trim().length > 500) errors.push('Ghi chú tối đa 500 ký tự.');

  const set = (i: number, patch: Partial<BandDraft>) =>
    setDraft(draft.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const openAddBand = () => {
    const lastMax = Math.max(0, ...draft.map(band => num(band.maxKm)).filter(Number.isFinite));
    setAddDraft({ minKm: String(lastMax), maxKm: '', handlingMinutes: '60', transitMinutes: '1440', cost: '0' });
  };

  const onPublish = async () => {
    if (errors.length || publish.isPending) return;
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
    setPublishOpen(false);
    setEffectiveFrom('');
    setNote('');
  };

  return (
    <div className="config-sections">
      <div className="transit-table-heading">
        <h2 className="sec">Bảng vận chuyển dùng chung</h2>
        <Chip tone="ok">Phiên bản {current.version} · {new Date(current.effectiveFrom).getTime() > now ? 'Chờ hiệu lực' : 'Đang áp dụng'}</Chip>
        <span className="muted small">Hiệu lực từ {formatInstantDate(current.effectiveFrom)}</span>
        <Button size="sm" variant="primary" onClick={openAddBand}>Thêm khoảng</Button>
      </div>

      <div className="transit-editor">
      <SimpleTable
        rows={draft}
        columns={[
          {
            header: 'Từ (km)', width: '110px',
            cell: (_, i) => <Input className="inp-sm" inputMode="decimal" aria-label={`Từ km dòng ${i + 1}`} value={draft[i].minKm} onChange={(e) => set(i, { minKm: e.target.value })} />,
          },
          {
            header: 'Đến (km)', width: '110px',
            cell: (_, i) => <Input className="inp-sm" inputMode="decimal" aria-label={`Đến km dòng ${i + 1}`} value={draft[i].maxKm} onChange={(e) => set(i, { maxKm: e.target.value })} />,
          },
          {
            header: 'Soạn (phút)', width: '120px',
            cell: (_, i) => <Input className="inp-sm" inputMode="numeric" aria-label={`Thời gian soạn dòng ${i + 1}`} value={draft[i].handlingMinutes} onChange={(e) => set(i, { handlingMinutes: e.target.value })} />,
          },
          {
            header: 'Vận chuyển (phút)', width: '150px',
            cell: (_, i) => <Input className="inp-sm" inputMode="numeric" aria-label={`Thời gian vận chuyển dòng ${i + 1}`} value={draft[i].transitMinutes} onChange={(e) => set(i, { transitMinutes: e.target.value })} />,
          },
          {
            header: 'Chi phí ước tính (VND)', width: '180px',
            cell: (_, i) => <Input className="inp-sm" inputMode="numeric" aria-label={`Chi phí ước tính dòng ${i + 1}`} value={draft[i].cost} onChange={(e) => set(i, { cost: e.target.value })} />,
          },
          {
            header: '', width: '60px',
            cell: (_, i) => (
              <Button size="sm" variant="ghost" onClick={() => setDraft(draft.filter((__, j) => j !== i))}>Xoá</Button>
            ),
          },
        ]}
      />

      </div>

      {draftErrors.length > 0 && <Callout tone="warn">
        <ul>{draftErrors.map(error => <li key={error}>{error}</li>)}</ul>
      </Callout>}
      <div className="config-actions">
        <Button variant="primary" disabled={draft.length === 0 || publish.isPending} onClick={() => setPublishOpen(true)}>
          Phát hành phiên bản mới
        </Button>
      </div>

      <section className="transit-history" aria-label="Lịch sử bảng vận chuyển">
        <h3 className="sec">Lịch sử</h3>
        <QueryState query={history}>{tables => {
          // Effective dates identify the live version even when a newer publication is scheduled.
          const archived = tables.filter(table => new Date(table.effectiveFrom).getTime() > now ||
            (table.effectiveTo !== null && new Date(table.effectiveTo).getTime() <= now));
          return archived.length === 0
          ? <p>Chưa có phiên bản lịch sử.</p>
          : [...archived].sort((a, b) => b.version - a.version).map(table =>
            <ExpandableRecord key={table.id} title={`Phiên bản ${table.version}`}
              subtitle={`Hiệu lực từ ${formatInstantDate(table.effectiveFrom)}${table.effectiveTo ? ` đến ${formatInstantDate(table.effectiveTo)}` : ''}`}
              meta={`${table.bands.length} khoảng`} actionLabel="Chi tiết">
              <div className="config-section-body">
                <div className="row gap-sm items-center">
                  <Chip tone={table.effectiveTo && new Date(table.effectiveTo).getTime() <= now ? 'neutral' : new Date(table.effectiveFrom).getTime() > now ? 'warn' : 'ok'}>
                    {table.effectiveTo && new Date(table.effectiveTo).getTime() <= now ? 'Đã kết thúc' : new Date(table.effectiveFrom).getTime() > now ? 'Chờ hiệu lực' : 'Đang áp dụng'}
                  </Chip>
                  <span>Bán kính phục vụ: {table.maxServingDistanceMeters / 1000} km</span>
                </div>
                {table.note && <p>Ghi chú: {table.note}</p>}
                <SimpleTable rows={table.bands} paginate={false} columns={[
                  { header: 'Từ (km)', cell: b => b.minDistanceMeters / 1000 },
                  { header: 'Đến (km)', cell: b => b.maxDistanceMeters / 1000 },
                  { header: 'Soạn (phút)', cell: b => b.handlingMinutes },
                  { header: 'Vận chuyển (phút)', cell: b => b.transitMinutes },
                  { header: 'Chi phí ước tính (VND)', cell: b => formatMoney(b.estimatedCostAmount) },
                ]} />
              </div>
            </ExpandableRecord>);
        }}</QueryState>
      </section>
      <Modal open={publishOpen} title="Phát hành bảng vận chuyển" onClose={() => { if (!publish.isPending) setPublishOpen(false); }} width={640}
        footer={<>
          <Button disabled={publish.isPending} onClick={() => setPublishOpen(false)}>Hủy</Button>
          <Button variant="primary" loading={publish.isPending} disabled={errors.length > 0} onClick={onPublish}>Phát hành</Button>
        </>}>
        <div className="config-section-body">
          <div className="form-grid cols-2">
            <FormField label="Bán kính phục vụ (km)">
              <Input inputMode="decimal" value={servingKm} onChange={e => setServingKm(e.target.value)} />
            </FormField>
            <FormField label="Ngày hiệu lực">
              <Input type="date" min={minimumVersionDate(current.effectiveFrom)} value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
            </FormField>
            <FormField label="Ghi chú" span={2}>
              <Input maxLength={500} value={note} onChange={e => setNote(e.target.value)} />
            </FormField>
          </div>
          {errors.length > 0 && <Callout tone="warn"><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></Callout>}
        </div>
      </Modal>
      {addDraft && <AddBandDialog initial={addDraft} existing={draft} onClose={() => setAddDraft(null)}
        onAdd={band => { setDraft([...draft, band]); setAddDraft(null); }} />}
    </div>
  );
}


function AddBandDialog({ initial, existing, onAdd, onClose }: {
  initial: BandDraft; existing: BandDraft[]; onAdd: (band: BandDraft) => void; onClose: () => void;
}) {
  const [band, setBand] = useState(initial);
  const min = num(band.minKm), max = num(band.maxKm);
  const errors: string[] = [];
  if (!validKilometers(min) || !validKilometers(max) || max <= min)
    errors.push('Nhập khoảng cách hợp lệ; km kết thúc phải lớn hơn km bắt đầu.');
  if (!validMinutes(band.handlingMinutes) || !validMinutes(band.transitMinutes) ||
      num(band.handlingMinutes) + num(band.transitMinutes) > 2147483647)
    errors.push('Thời gian phải là số phút nguyên không âm, tổng không vượt 2147483647.');
  if (!validMoney(num(band.cost))) errors.push('Chi phí phải là số không âm, tối đa 2 chữ số thập phân.');
  if (existing.some(row => min < num(row.maxKm) && max > num(row.minKm)))
    errors.push('Khoảng cách này chồng lên một khoảng đã có.');
  const update = (field: keyof BandDraft, value: string) => setBand({ ...band, [field]: value });
  const submit = () => { if (errors.length) return; onAdd(band); };
  return <Modal open title="Thêm khoảng cách vận chuyển" onClose={onClose} width={640}
    footer={<>
      <Button onClick={onClose}>Hủy</Button>
      <Button variant="primary" disabled={errors.length > 0} onClick={submit}>Thêm khoảng</Button>
    </>}>
    <div className="config-section-body">
      <div className="form-grid cols-2">
        <FormField label="Từ (km)"><Input autoFocus inputMode="decimal" value={band.minKm} onChange={e => update('minKm', e.target.value)} /></FormField>
        <FormField label="Đến (km)"><Input inputMode="decimal" value={band.maxKm} onChange={e => update('maxKm', e.target.value)} /></FormField>
        <FormField label="Soạn (phút)"><Input inputMode="numeric" value={band.handlingMinutes} onChange={e => update('handlingMinutes', e.target.value)} /></FormField>
        <FormField label="Vận chuyển (phút)"><Input inputMode="numeric" value={band.transitMinutes} onChange={e => update('transitMinutes', e.target.value)} /></FormField>
        <FormField label="Chi phí ước tính (VND)"><Input inputMode="decimal" value={band.cost} onChange={e => update('cost', e.target.value)} /></FormField>
      </div>
      {errors.length > 0 && <Callout tone="warn"><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></Callout>}
    </div>
  </Modal>;
}
